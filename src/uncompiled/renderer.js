const EVENTS_TO_PROXY = [
  'change',
  'click',
  'focus',
];

/** Sets up a bidirectional DOM Mutation+Event proxy to a Workerized app.
 *  @param {Worker} opts.worker   The WebWorker instance to proxy to.
 */
export default ({worker}) => {
  const NODES = new Map();

  /** Returns the real DOM Element corresponding to a serialized Element object. */
  function getNode(node) {
    if (!node) {
      return null;
    }
    if (node.nodeName === 'BODY') {
      return document.body;
    }
    return NODES.get(node.__id);
  }

  EVENTS_TO_PROXY.forEach((e) => {
    addEventListener(e, proxyEvent, {capture: true, passive: true});
  });

  let touchStart;

  /** Derives {pageX,pageY} coordinates from a mouse or touch event. */
  function getTouch(e) {
    let t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
    return t && {pageX: t.pageX, pageY: t.pageY};
  }

  /** Forward a DOM Event into the Worker as a message */
  function proxyEvent(e) {
    if (e.type === 'click' && touchStart) {
      return false;
    }

    let event = {type: e.type};
    if (e.target) {
      event.target = e.target.__id;
    }

    // For change events, update worker with new `value` prop.
    // TODO(willchou): Generify this special-case.
    if (e.type == 'change' && 'value' in e.target) {
      event.__value = e.target.value;
    }

    for (let i in e) {
      let v = e[i];
      const typeOfV = typeof v;
      if (typeOfV !== 'object' && typeOfV !== 'function'
          && i !== i.toUpperCase() && !event.hasOwnProperty(i)) {
        event[i] = v;
      }
    }

    worker.postMessage({
      type: 'event',
      event,
    });

    // Recategorize very close touchstart/touchend events as clicks.
    if (e.type === 'touchstart') {
      touchStart = getTouch(e);
    } else if (e.type === 'touchend' && touchStart) {
      let touchEnd = getTouch(e);
      if (touchEnd) {
        let dist = Math.sqrt(Math.pow(touchEnd.pageX - touchStart.pageX, 2) + Math.pow(touchEnd.pageY - touchStart.pageY, 2));
        if (dist < 10) {
          event.type = 'click';
          worker.postMessage({type: 'event', event});
        }
      }
    }
  }


  /** Create a real DOM Node from a skeleton Object (`{ nodeType, nodeName, attributes, children, data }`)
  * @example <caption>Text node</caption>
  *   createNode({ nodeType:3, data:'foo' })
  * @example <caption>Element node</caption>
  *   createNode({ nodeType:1, nodeName:'div', attributes:[{ name:'a', value:'b' }], childNodes:[ ... ] })
   */
  function createNode(skeleton) {
    let node;
    if (skeleton.nodeType === Node.TEXT_NODE) {
      node = document.createTextNode(skeleton.data);
    } else if (skeleton.nodeType === Node.ELEMENT_NODE) {
      node = document.createElement(skeleton.nodeName);
      if (skeleton.className) {
        node.className = skeleton.className;
      }
      if (skeleton.style) {
        for (let i in skeleton.style) {
          if (skeleton.style.hasOwnProperty(i)) {
            node.style[i] = skeleton.style[i];
          }
        }
      }
      if (skeleton.attributes) {
        for (let i = 0; i < skeleton.attributes.length; i++) {
          const a = skeleton.attributes[i];
          node.setAttribute(a.name, a.value);
        }
      }
      if (skeleton.childNodes) {
        for (let i = 0; i < skeleton.childNodes.length; i++) {
          node.appendChild(createNode(skeleton.childNodes[i]));
        }
      }
    }
    bindNodeToSkeletonId(node, skeleton.__id);
    return node;
  }


  /** Apply MutationRecord mutations, keyed by type. */
  const MUTATIONS = {
    /** Handles element insertion & deletion */
    childList({target, removedNodes, addedNodes, previousSibling, nextSibling}) {
      let parent = getNode(target);
      if (removedNodes) {
        for (let i = removedNodes.length; i--; ) {
          parent.removeChild(getNode(removedNodes[i]));
        }
      }
      if (addedNodes) {
        for (let i = 0; i < addedNodes.length; i++) {
          let newNode = getNode(addedNodes[i]);
          if (!newNode) {
            newNode = createNode(addedNodes[i]);
          }
          parent.insertBefore(newNode, nextSibling && getNode(nextSibling) || null);
        }
      }
    },
    /** Handles attribute addition, change, removal */
    attributes({target, attributeName}) {
      let val;
      for (let i = target.attributes.length; i--; ) {
        let p = target.attributes[i];
        if (p.name === attributeName) {
          val = p.value;
          break;
        }
      }
      getNode(target).setAttribute(attributeName, val);
    },
    /** Handles Text node content changes */
    characterData({target, oldValue}) {
      getNode(target).nodeValue = target.data;
    },
    /** [Non-standard] Handles property updates */
    properties({target, propertyName, oldValue, newValue}) {
      const node = getNode(target);
      console.assert(node);
      node[propertyName] = newValue;
    },
  };

  let timer;

  // stores pending DOM changes (MutationRecord objects)
  let MUTATION_QUEUE = [];

  // Check if an Element is at least partially visible
  function isElementInViewport(el, cache) {
    if (el.nodeType === 3) {
      el = el.parentNode;
    }
    let bbox = el.getBoundingClientRect();
    return (
      bbox.bottom >= 0 &&
      bbox.right >= 0 &&
      bbox.top <= (cache.height || (cache.height = window.innerHeight)) &&
      bbox.left <= (cache.width || (cache.width = window.innerWidth))
    );
  }

  // Attempt to flush & process as many MutationRecords as possible from the queue
  function processMutationQueue(deadline) {
    clearTimeout(timer);

    const q = MUTATION_QUEUE;
    const start = Date.now();
    const isDeadline = deadline && deadline.timeRemaining;
    const cache = {};

    for (let i = 0; i < q.length; i++) {
      if (isDeadline
          ? deadline.timeRemaining() <= 0
          : (Date.now() - start) > 1) {
        break;
      }
      let m = q[i];

      // if the element is offscreen, skip any text or attribute changes:
      if (m.type === 'characterData' || m.type === 'attributes') {
        let target = getNode(m.target);
        if (target && !isElementInViewport(target, cache)) {
          continue;
        }
      }

      // remove mutation from the queue and apply it:
      const mutation = q.splice(i--, 1)[0];
      MUTATIONS[mutation.type](mutation);
    }

    // still remaining work to be done
    if (q.length) {
      doProcessMutationQueue();
    }
  }


  function doProcessMutationQueue() {
    clearTimeout(timer);
    timer = setTimeout(processMutationQueue, 100);
    requestIdleCallback(processMutationQueue);
  }


  // Add a MutationRecord to the queue
  function queueMutation(mutation) {
    // for single-node updates, merge into pending updates
    if (mutation.type === 'characterData' || mutation.type === 'attributes') {
      for (let i = MUTATION_QUEUE.length; i--; ) {
        let m = MUTATION_QUEUE[i];
        if (m.type == mutation.type && m.target.__id == mutation.target.__id) {
          if (m.type === 'attributes') {
            MUTATION_QUEUE.splice(i + 1, 0, mutation);
          } else {
            MUTATION_QUEUE[i] = mutation;
          }
          return;
        }
      }
    }
    if (MUTATION_QUEUE.push(mutation) === 1) {
      doProcessMutationQueue();
    }
  }

  /**
   * Establish link between DOM element `el` and worker-generated identifier `id`.
   * @param {*} el
   * @param {*} id
   */
  function bindNodeToSkeletonId(el, id) {
    el.__id = id;
    NODES.set(id, el);
  }

  /**
   * Recursively hydrates AOT rendered `node` with corresponding worker `skeleton`.
   * @param {*} node
   * @param {*} skeleton
   */
  function hydrate(node, skeleton) {
    assertMatchesSkeleton(node, skeleton);
    bindNodeToSkeletonId(node, skeleton.__id);
    for (let i = 0; i < skeleton.childNodes.length; i++) {
      hydrate(node.childNodes[i], skeleton.childNodes[i]);
    }
  }

  /**
   * @param {*} node
   * @param {*} skeleton
   */
  function assertMatchesSkeleton(node, skeleton) {
    console.assert(node.nodeType == skeleton.nodeType);
    console.assert(node.nodeName == skeleton.nodeName);
    console.assert(node.childNodes.length == skeleton.childNodes.length);
    console.assert(!node.__id && skeleton.__id);
  }

  let initialRender = true;
  const aotRoot = document.querySelector('[amp-aot]');

  // Testing SAB.
  // const buffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 1);
  // const array = new Int32Array(buffer);
  // Atomics.store(array, 0, 123);

  worker.onmessage = ({data}) => {
    if (data.type === 'MutationRecord') {
      for (let i = 0; i < data.mutations.length; i++) {
        const mutation = data.mutations[i];

        // TODO: Improve heuristic for identifying initial render.
        if (initialRender && aotRoot) {
          // Check if mutation record looks like the root containing `amp-aot` attr.
          // If so, set __id on all matching DOM elements.
          console.log('Hydrating AOT root: ', aotRoot);
          console.assert(mutation.type == 'childList' && mutation.addedNodes);
          mutation.addedNodes.forEach(n => hydrate(aotRoot, n));
          continue;
        } else if (initialRender) {
          console.warn('No AOT root found!');
        }

        queueMutation(mutation);
      }

      initialRender = false;
    }
    // console.log('Array now contains: ' + array[0]); // Testing SAB.
  };


  worker.postMessage({
    type: 'init',
    location: location.href,
    // buffer, // Testing SAB.
  });
};
