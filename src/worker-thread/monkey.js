/**
 * Monkey-patch WorkerGlobalScope.
 */

const monkeyScope = {
  document: undom(),
  history: {
    pushState(a, b, url) {
      send({type: 'pushState', url});
    },
    replaceState(a, b, url) {
      send({type: 'replaceState', url});
    },
  },
  localStorage: {},
  location: {
    _current: '/',
    get href() {
      return url;
    },
    get pathname() {
      return null;
    },
    get search() {
      return null;
    },
    get hash() {
      return null;
    },
  },
  url: '/',
};
// Surface top-level undom window properties e.g document, Element.
const undomWindow = monkeyScope.document.defaultView;
for (let i in undomWindow) {
  if (undomWindow.hasOwnProperty(i)) {
    monkeyScope[i] = undomWindow[i];
  }
}

/**
 * Worker communication layer.
 */

// Use an IIFE to "store" references to globals that we'll dereference from `self` below.
// This makes sure that (1) privileged functions like postMessage() can't be invoked by 3P JS
// and (2) we don't pollute the global scope with new variables/functions.
(function(__scope, __postMessage) {
  let NODE_COUNTER = 0;

  const TO_SANITIZE = ['addedNodes', 'removedNodes', 'nextSibling', 'previousSibling', 'target'];

  // TODO(willchou): Replace this with something more generic.
  const PROP_BLACKLIST = ['children', 'parentNode', '__handlers', '_component', '_componentConstructor'];

  const NODES = new Map();

  function getNode(node) {
    let id;
    if (node && typeof node === 'object') {
      id = node.__id;
    }
    if (typeof node === 'string') {
      id = node;
    }
    if (!id) {
      return null;
    }
    if (node.nodeName === 'BODY') {
      return document.body;
    }
    const n = NODES.get(id);
    return n;
  }

  function handleEvent(event) {
    let target = getNode(event.target);
    if (target) {
      // Update worker DOM with user changes to <input> etc.
      if ('__value' in event) {
        target.value = event.__value;
      }
      event.target = target;
      event.bubbles = true;
      target.dispatchEvent(event);
    }
  }

  function sanitize(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (obj instanceof __scope.document.defaultView.Node) {
      let id = obj.__id;
      if (!id) {
        id = obj.__id = String(++NODE_COUNTER);
      }
      NODES.set(id, obj);
    }

    let out = {};
    for (let i in obj) {
      if (obj.hasOwnProperty(i) && PROP_BLACKLIST.indexOf(i) < 0) {
        out[i] = obj[i];
      }
    }
    if (out.childNodes && out.childNodes.length) {
      out.childNodes = sanitize(out.childNodes);
    }
    return out;
  }

  let hydrated = false;
  const observer = new __scope.MutationObserver(mutations => {
    for (let mutation of mutations) {
      // mutation.timestamp = performance.now();
      // Sanitize mutations. 
      // Let's move this to a fork of undom.
      // Sanitize during creation – not looping over mutations after they've already been created.

      for (let prop of TO_SANITIZE) {
        mutation[prop] = sanitize(mutation[prop]);
      }
    }
    if (hydrated == true) {
      send({type: 'mutate', mutations});
    } else {
      send({type: 'hydrate', mutations});
      hydrated = true;
    }
  });
  observer.observe(__scope.document, {subtree: true});

  function send(message) {
    // TODO: KB – via @surma, Structural Clone Performance can be improved.
    __postMessage({...JSON.parse(JSON.stringify(message)), timestamp: performance.now()});
  }

  addEventListener('message', ({data}) => {
    switch (data.type) {
      case 'init':
        __scope.url = data.url;
        break;
      case 'event':
        handleEvent(data.event);
        break;
    }
  });
})(monkeyScope, postMessage);

/**
 * Dereference non-whitelisted globals.
 */

// This is incomplete -- just grabbed the first ~50 properties on DedicatedGlobalWorkerScope object.
// TODO(willchou): Complete this list.
const WHITELISTED_GLOBALS = {
  'Object': true,
  'Function': true,
  'Array': true,
  'Number': true,
  'parseFloat': true,
  'parseInt': true,
  'Infinity': true,
  'NaN': true,
  'undefined': true,
  'Boolean': true,
  'String': true,
  'Symbol': true,
  'Date': true,
  'Promise': true,
  'RegExp': true,
  'Error': true,
  'EvalError': true,
  'RangeError': true,
  'ReferenceError': true,
  'SyntaxError': true,
  'TypeError': true,
  'URIError': true,
  'JSON': true,
  'Math': true,
  'console': true,
  'Intl': true,
  'ArrayBuffer': true,
  'Uint8Array': true,
  'Int8Array': true,
  'Uint16Array': true,
  'Int16Array': true,
  'Uint32Array': true,
  'Int32Array': true,
  'Float32Array': true,
  'Float64Array': true,
  'Uint8ClampedArray': true,
  'DataView': true,
  'Map': true,
  'Set': true,
  'WeakMap': true,
  'WeakSet': true,
  'Proxy': true,
  'Reflect': true,
  'decodeURI': true,
  'decodeURIComponent': true,
  'encodeURI': true,
  'encodeURIComponent': true,
  'escape': true,
  'unescape': true,
  'eval': true,
  'isFinite': true,
  'isNaN': true,
  // Custom additions.
  'performance': true,
  'setTimeout': true,
  'setInterval': true,
};
Object.keys(monkeyScope).forEach(monkeyProp => {
  WHITELISTED_GLOBALS[monkeyProp] = true;
});

// Delete non-whitelisted properties from global scope.
(function() {
  function deleteUnsafe(object, property) {
    if (WHITELISTED_GLOBALS[property]) {
      return;
    }
    // TODO(willchou): Instead of deleting, throw custom error at runtime?
    try {
      console.info(`Deleting "${property}"...`);
      delete object[property];
    } catch (e) {
      console.error(e)
    }
  }

  let current = self;
  while (current) {
    console.info('Removing unsafe references from:', current);
    Object.getOwnPropertyNames(current).forEach(prop => {
      deleteUnsafe(current, prop);
    });
    // getOwnPropertyNames() doesn't include inherited properties,
    // so manually walk up the prototype chain.
    current = Object.getPrototypeOf(current);
  }
})();
