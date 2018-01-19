// Chrome doesn't support ES6 modules in workers yet, so we dupe the flags
// on main page (renderer.js) and worker (undom.js).
const Flags = {
  REQUIRE_GESTURE_TO_MUTATE: false,
};

/**
 * Sets up a bidirectional DOM Mutation+Event proxy to a Workerized app.
 * @param {Worker} opts.worker The WebWorker instance to proxy to.
 */
export default ({worker}) => {
  const EVENTS_TO_PROXY = [
    'change',
    'click',
    'focus',
  ];

  const NODES = new Map();

  /** Returns the real DOM Element corresponding to a serialized Element object. */
  // TODO (KB): Seperate functions for different types.
  function getNode(nodeOrId) {
    if (!nodeOrId) {
      return null;
    }
    if (typeof nodeOrId == 'string') {
      return NODES.get(nodeOrId);
    }
    if (nodeOrId.nodeName === 'BODY') {
      return document.querySelector('#root'); // TODO(willchou): Dirty hack to render to a div instead of body.
    }
    return NODES.get(nodeOrId.__id);
  }

  EVENTS_TO_PROXY.forEach((e) => {
    addEventListener(e, proxyEvent, {capture: true, passive: true});
  });

  // Allow mutations up to 1s after user gesture.
  const GESTURE_TO_MUTATION_THRESHOLD = Flags.REQUIRE_GESTURE_TO_MUTATE ? 5000 : Infinity;
  let timeOfLastUserGesture = Date.now();

  let touchStart;

  /**
   * @param {*} message
   */
  function postToWorker(message) {
    const eventType = (message.event ? ':' + message.event.type : '');
    console.info(`Posting "${message.type + eventType}" to worker:`, message);
    worker.postMessage(message);
  }

  /** Derives {pageX,pageY} coordinates from a mouse or touch event. */
  function getTouch(e) {
    let t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
    return t && {pageX: t.pageX, pageY: t.pageY};
  }

  /** Forward a DOM Event into the Worker as a message */
  function proxyEvent(e) {
    timeOfLastUserGesture = Date.now();

    if (e.type === 'click' && touchStart) {
      return false;
    }

    let event = {type: e.type};
    if (e.target) {
      event.target = e.target.__id;
    }

    // For change events, update worker with new `value` prop.
    // TODO(willchou): Complete support for user input (e.g. input events, other props).
    if (e.type == 'change' && 'value' in e.target) {
      event.__value = e.target.value;
    }

    // Copy properties from `e` to proxied `event`.
    for (let i in e) {
      let v = e[i];
      const typeOfV = typeof v;
      if (typeOfV !== 'object' && typeOfV !== 'function'
          && i !== i.toUpperCase() && !event.hasOwnProperty(i)) {
        event[i] = v;
      }
    }

    postToWorker({type: 'event', event});

    // Recategorize very close touchstart/touchend events as clicks.
    // TODO(willchou): Unnecessary?
    if (e.type === 'touchstart') {
      touchStart = getTouch(e);
    } else if (e.type === 'touchend' && touchStart) {
      let touchEnd = getTouch(e);
      if (touchEnd) {
        let dist = Math.sqrt(Math.pow(touchEnd.pageX - touchStart.pageX, 2) + Math.pow(touchEnd.pageY - touchStart.pageY, 2));
        if (dist < 10) {
          event.type = 'click';
          postToWorker({type: 'event', event});
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
    if (skeleton.nodeType === Node.TEXT_NODE) {
      const node = document.createTextNode(skeleton.data);
      bindNodeToSkeletonId(node, skeleton.__id);
      return node;
    }
    
    const node = document.createElement(skeleton.nodeName);
    if (skeleton.className) {
      node.className = skeleton.className;
    }
    if (skeleton.style) {
      for (let i in skeleton.style) {
        node.style[i] = skeleton.style[i];
      }
    }
    if (skeleton.attributes) {
      for (let attribute of skeleton.attributes) {
        node.setAttribute(attribute.name, attribute.value);
      }
    }
    if (skeleton.childNodes) {
      for (let childNode of skeleton.childNodes) {
        node.appendChild(createNode(childNode));  
      }
    }
    bindNodeToSkeletonId(node, skeleton.__id);
    return node;
  }

  /** Apply MutationRecord mutations, keyed by type. */
  const MUTATIONS = {
    childList({target, removedNodes, addedNodes, nextSibling}) {
      let parent = getNode(target);
      if (removedNodes) {
        for (let i = removedNodes.length; i--;) {
          parent.removeChild(getNode(removedNodes[i]));
        }
      }
      if (addedNodes) {
        for (let addedNode of addedNodes) {
          let newNode = getNode(addedNode);
          if (!newNode) {
            newNode = createNode(addedNode);
          }
          parent.insertBefore(newNode, nextSibling && getNode(nextSibling) || null);
        }
      }
    },
    attributes(mutation) {
      getNode(mutation.target).setAttribute(mutation.attributeName, mutation.value);
    },
    characterData(mutation) {
      getNode(mutation.target).nodeValue = mutation.value;
    },
    // Non-standard MutationRecord for property changes.
    properties(mutation) {
      const node = getNode(mutation.target);
      node[mutation.propertyName] = mutation.value;
    },
  };

  // stores pending DOM changes (MutationRecord objects)
  let MUTATION_QUEUE = [];

  function processMutationsSync() {
    let removed = 0;
    for (let mutation of MUTATION_QUEUE) {
      MUTATIONS[mutation.type](mutation);
      removed++;
    }
    MUTATION_QUEUE.splice(0, removed); 
  }

  // Attempt to flush & process as many MutationRecords as possible from the queue
  function processMutationsAsync(deadline) {
    const start = performance.now();
    const isDeadline = deadline && deadline.timeRemaining;
    const mutationLenth = MUTATION_QUEUE.length;
    let removed = 0;

    for (let mutation of MUTATION_QUEUE) {
      MUTATIONS[mutation.type](mutation);
      removed++;

      if (isDeadline && deadline.timeRemaining() <= 0) {
        console.warn('RequestIdleCallback timeRemaining <= 0', removed);
        break;
      } else if (!isDeadline && (performance.now() - start) > 1) {
        break;
      } else if (mutation.timestamp - timeOfLastUserGesture > GESTURE_TO_MUTATION_THRESHOLD) {
        console.warn(`Mutation latency exceeded. Queued until next gesture: `, m);
        break;
      }
    }

    MUTATION_QUEUE.splice(0, removed);
    if (removed < mutationLenth) {
      requestIdleCallback(processMutationsAsync);
    }
  }

  /**
   * Establish link between DOM `node` and worker-generated identifier `id`.
   * @param {!Node} node
   * @param {string} id
   */
  function bindNodeToSkeletonId(node, id) {
    node.__id = id;
    NODES.set(id, node);
  }

  /**
   * Recursively hydrates AOT rendered `node` with corresponding worker `skeleton`.
   * @param {!Node} node
   * @param {!Object} skeleton
   */
  function hydrate(node, skeleton) {
    assertMatchesSkeleton(node, skeleton);
    bindNodeToSkeletonId(node, skeleton.__id);
    for (let i = 0; i < skeleton.childNodes.length; i++) {
      hydrate(node.childNodes[i], skeleton.childNodes[i]);
    }
  }

  /**
   * @param {!Node} node
   * @param {!Object} skeleton
   */
  function assertMatchesSkeleton(node, skeleton) {
    console.assert(node.nodeType == skeleton.nodeType);
    console.assert(node.nodeName == skeleton.nodeName);
    console.assert(node.childNodes.length == skeleton.childNodes.length);
    console.assert(!node.__id && skeleton.__id);
  }

  let initialRender = true;
  const aotRoot = document.querySelector('[amp-aot]');
  const metrics = document.querySelector('#metrics');

  function repaintDirty(skeleton) {
    if (skeleton.dirty) {
      // TODO(willchou): Support repainting non-text nodes.
      if (skeleton.nodeType == Node.TEXT_NODE) {
        getNode(skeleton).nodeValue = skeleton.data;
      }
      skeleton.dirty = false;
    }
    skeleton.childNodes.forEach(child => {
      repaintDirty(child);
    });
  }

  let domSkeleton = null;

  worker.onmessage = ({data}) => {
    if (metrics) {
      const latency = window.performance.now() - data.timestamp;
      metrics.textContent = latency;
    }

    // console.info(`Received "${data.type}" from worker:`, data);

    switch (data.type) {
      case 'init-render':
        break;

      case 'dom-update':
        console.assert(domSkeleton);
        domSkeleton = deserializeDom();
        repaintDirty(domSkeleton);
        break;

      case 'hydrate':
        if (!aotRoot) {
          console.warn('AOT root missing.');
          return;
        }

        for (let mutation of data.mutations) {
          // Check if mutation record looks like the root containing `amp-aot` attr.
          // If so, set __id on all matching DOM elements.
          console.info('Hydrating AOT root: ', aotRoot);
          console.assert(mutation.type == 'childList' && mutation.addedNodes);
          mutation.addedNodes.forEach(n => hydrate(aotRoot, n));
        }
        break;

      case 'mutate':
        MUTATION_QUEUE = MUTATION_QUEUE.concat(data.mutations);
        // if (async) requestIdleCallback(processMutationsAsync);
        // else setTimeout(processMutations);
        setTimeout(processMutationsSync);
        break;
    }
  };

  postToWorker({
    type: 'init',
    location: location.href,
  });
};
