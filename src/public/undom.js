// Prevent leaking global in functions with no callers.
'use strict';

// Chrome doesn't support ES6 modules in workers yet, so we dupe the flags
// on main page (renderer.js) and worker (undom.js).
const Flags = {
  REQUIRE_GESTURE_TO_MUTATE: false,
  USE_SHARED_ARRAY_BUFFER: false,
};

let initialRenderComplete = false;

// Variables in global scope are not enumerable and won't be dereferenced
// (which wouldn't work anyways).
// TODO(willchou): Figure out a way to avoid polluting the global scope with
// these variables/functions or define a naming convention for them.
let undom = function() {
  let observers = [];
  let pendingMutations = false;

  function assign(obj, props) {
    for (let i in props) { // eslint-disable-line guard-for-in
      obj[i] = props[i];
    }
  }

  function toLower(str) {
    return String(str).toLowerCase();
  }

  function createAttributeFilter(ns, name) {
    return (o) => o.ns === ns && toLower(o.name) === toLower(name);
  }

  function splice(arr, item, add, byValueOnly) {
    let i = arr ? findWhere(arr, item, true, byValueOnly) : -1;
    if (~i) {
      add
          ? arr.splice(i, 0, add)
          : arr.splice(i, 1);
    }
    return i;
  }

  function findWhere(arr, fn, returnIndex, byValueOnly) {
    let i = arr.length;
    while (i--) {
      if (typeof fn === 'function' && !byValueOnly
          ? fn(arr[i])
          : arr[i] === fn) {
        break;
      }
    }
    return returnIndex ? i : arr[i];
  }

  /**
   * Node.
   */
  class Node {
    constructor(nodeType, nodeName) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
      this.childNodes = [];
      this.dirty = false;
    }
    /**
     * True if this property is defined by this class or any of its superclasses.
     * @returns {boolean}
     */
    propertyIsInherited(property) {
      return ['nodeType', 'nodeName', 'childNodes', 'parentNode'].indexOf(property) >= 0;
    }
    appendChild(child) {
      child.remove();
      child.parentNode = this;
      this.childNodes.push(child);
      if (this.children && child.nodeType === 1) {
        this.children.push(child);
      }
      mutation(this, 'childList', {addedNodes: [child], previousSibling: this.childNodes[this.childNodes.length - 2]});
    }
    insertBefore(child, ref) {
      child.remove();
      let i = splice(this.childNodes, ref, child), ref2;
      if (!ref) {
        this.appendChild(child);
      } else {
        if (~i && child.nodeType === 1) {
          while (i < this.childNodes.length && (ref2 = this.childNodes[i]).nodeType !== 1 || ref === child) {
            i++;
          }
          if (ref2) {
            splice(this.children, ref, child);
          }
        }
        mutation(this, 'childList', {addedNodes: [child], nextSibling: ref});
      }
    }
    replaceChild(child, ref) {
      if (ref.parentNode === this) {
        this.insertBefore(child, ref);
        ref.remove();
      }
    }
    removeChild(child) {
      let i = splice(this.childNodes, child);
      if (child.nodeType === 1) {
        splice(this.children, child);
      }
      mutation(this, 'childList', {removedNodes: [child], previousSibling: this.childNodes[i - 1], nextSibling: this.childNodes[i]});
    }
    remove() {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    }
  }

  class Text extends Node {
    constructor(text) {
      super(3, '#text'); // TEXT_NODE
      this.data = text;
    }
    /** @override */
    propertyIsInherited(property) {
      return super.propertyIsInherited(property) || ['data'].indexOf(property) >= 0;
    }
    get textContent() {
      return this.data;
    }
    set textContent(value) {
      let oldValue = this.data;
      this.data = value;
      mutation(this, 'characterData', {value, oldValue});
    }
    get nodeValue() {
      return this.data;
    }
    set nodeValue(value) {
      this.textContent = value;
    }
  }

  class Element extends Node {
    constructor(nodeType, nodeName) {
      super(nodeType || 1, nodeName); // ELEMENT_NODE

      this.attributes = [];
      this.children = [];
      this.style = {};

      this.__handlers = {};

      Object.defineProperty(this, 'className', {
        set: (val) => {
          this.setAttribute('class', val);
        },
        get: () => this.getAttribute('style'),
      });
      Object.defineProperty(this.style, 'cssText', {
        set: (val) => {
          this.setAttribute('style', val);
        },
        get: () => this.getAttribute('style'),
      });
    }
    /** @override */
    propertyIsInherited(property) {
      return super.propertyIsInherited(property) || ['attributes', 'children', 'style'].indexOf(property) >= 0;
    }
    setAttribute(key, value) {
      this.setAttributeNS(null, key, value);
    }
    getAttribute(key) {
      return this.getAttributeNS(null, key);
    }
    removeAttribute(key) {
      this.removeAttributeNS(null, key);
    }
    setAttributeNS(ns, name, value) {
      let attr = findWhere(this.attributes, createAttributeFilter(ns, name)),
        oldValue = attr && attr.value;
      if (!attr) {
        this.attributes.push(attr = {ns, name});
      }
      attr.value = String(value);
      mutation(this, 'attributes', {attributeName: name, attributeNamespace: ns, value: attr.value, oldValue});
    }
    getAttributeNS(ns, name) {
      let attr = findWhere(this.attributes, createAttributeFilter(ns, name));
      return attr && attr.value;
    }
    removeAttributeNS(ns, name) {
      splice(this.attributes, createAttributeFilter(ns, name));
      mutation(this, 'attributes', {attributeName: name, attributeNamespace: ns, oldValue: this.getAttributeNS(ns, name)});
    }
    addEventListener(type, handler) {
      (this.__handlers[toLower(type)] || (this.__handlers[toLower(type)] = [])).push(handler);
    }
    removeEventListener(type, handler) {
      splice(this.__handlers[toLower(type)], handler, 0, true);
    }
    dispatchEvent(event) {
      let t = event.currentTarget = this,
        c = event.cancelable,
        l, i;
      do {
        l = t.__handlers && t.__handlers[toLower(event.type)];
        if (l) {
          for (i = l.length; i--; ) {
            if ((l[i].call(t, event) === false || event._end) && c) {
              break;
            }
          }
        }
      } while (event.bubbles && !(c && event._stop) && (event.target = t = t.parentNode));
      return !event.defaultPrevented;
    }
  }

  class SVGElement extends Element {}

  class Document extends Element {
    constructor() {
      super(9, '#document'); // DOCUMENT_NODE
    }
  }

  const PREACT_PROPS = {
    "_dirty": "__d",
    "_disable": "__x",
    "_listeners": "__l",
    "_renderCallbacks": "__h",
    "__key": "__k",
    "__ref": "__r",
    "normalizedNodeName": "__n",
    "nextBase": "__b",
    "prevContext": "__c",
    "prevProps": "__p",
    "prevState": "__s",
    "_parentComponent": "__u",
    "_componentConstructor": "_componentConstructor",
    "__html": "__html",
    "_component": "_component",
    "__preactattr_": "__preactattr_"
  };

  /**
   * @param {!Object} target
   * @param {*} value
   * @returns {boolean}
   */
  function isDOMProperty(target, value) {
    if (typeof value != 'string') { // Ignore symbols.
      return false;
    }
    if (value.startsWith('_') || value.endsWith('_')) { // Ignore private props.
      return false;
    }
    if (PREACT_PROPS[value]) { // TODO(willchou): Replace this with something better.
      return false;
    }
    if (!target.propertyIsEnumerable(value)) {
      return false;
    }
    if (target.propertyIsInherited(value)) { // Skip Node.nodeType etc.
      return false;
    }
    return true;
  }

  /**
   * Handler object that defines traps for proxying Element.
   * Used to observe property changes and trigger mutations from them.
   */
  const ElementProxyHandler = {
    set(target, property, value, receiver) {
      const oldValue = target[property];
      if (oldValue === value) {
        return true;
      }
      target[property] = value;
      if (isDOMProperty(target, property)) {
        // Update attribute on first render (mimic DOM behavior of props vs. attrs).
        if (!target.getAttribute(property)) {
          target.setAttribute(property, value);
        }
        mutation(target, 'properties', {propertyName: property, value, oldValue});
      }
      return true;
    },
    has(target, property) {
      // Necessary since Preact checks `in` before setting properties on elements.
      return isDOMProperty(target, property);
    }
  };

  class Event {
    constructor(type, opts) {
      this.type = type;
      this.bubbles = !!opts.bubbles;
      this.cancelable = !!opts.cancelable;
    }
    stopPropagation() {
      this._stop = true;
    }
    stopImmediatePropagation() {
      this._end = this._stop = true;
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
  }

  function mutation(target, type, record) {
    record.target = target.__id || target; // Use __id if available.
    record.type = type;

    if (Flags.USE_SHARED_ARRAY_BUFFER) {
      if (initialRenderComplete) {
        target.dirty = true;
        serializeDom();
        postMessage({type: 'dom-update'});
      }
      return;
    }

    for (let i = observers.length; i--; ) {
      let ob = observers[i];
      let match = target === ob._target;
      if (!match && ob._options.subtree) {
        do {
          if ((match = target === ob._target)) {
            break;
          }
        } while ((target = target.parentNode));
      }
      if (match) {
        ob._records.push(record);
        if (!pendingMutations) {
          pendingMutations = true;
          Promise.resolve().then(flushMutations);
        }
      }
    }
  }

  function flushMutations() {
    pendingMutations = false;
    for (let i = observers.length; i--; ) {
      let ob = observers[i];
      if (ob._records.length) {
        ob.callback(ob.takeRecords());
      }
    }
  }

  class MutationObserver {
    constructor(callback) {
      this.callback = callback;
      this._records = [];
    }
    observe(target, options) {
      this.disconnect();
      this._target = target;
      this._options = options || {};
      observers.push(this);
    }
    disconnect() {
      this._target = null;
      splice(observers, this);
    }
    takeRecords() {
      return this._records.splice(0, this._records.length);
    }
  }

  function createElement(type) {
    const t = String(type).toUpperCase();
    const element = new Element(null, t);
    if (Flags.USE_SHARED_ARRAY_BUFFER) {
      return element;
    } else {
      // Use proxy so we can observe and forward property changes e.g. HTMLInputElement.value.
      const proxy = new Proxy(element, ElementProxyHandler);
      return proxy;
    }
  }

  function createElementNS(ns, type) {
    let element = createElement(type);
    element.namespace = ns;
    return element;
  }

  function createTextNode(text) {
    return new Text(text);
  }

  function createDocument() {
    let document = new Document();
    assign(document, document.defaultView = {document, MutationObserver, Document, Node, Text, Element, SVGElement, Event});
    assign(document, {documentElement: document, createElement, createElementNS, createTextNode});
    document.appendChild(document.body = createElement('body'));
    return document;
  }

  return createDocument();
};
