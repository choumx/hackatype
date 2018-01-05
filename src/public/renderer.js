// Chrome doesn't support ES6 modules in workers yet, so we dupe the flags
// on main page (renderer.js) and worker (undom.js).
const Flags = {
  REQUIRE_GESTURE_TO_MUTATE: false,
  USE_SHARED_ARRAY_BUFFER: false,
};

/**
 * Sets up a bidirectional DOM Mutation+Event proxy to a Workerized app.
 * @param {Worker} opts.worker The WebWorker instance to proxy to.
 */
export default ({worker}) => {
  const EVENTS_TO_PROXY = ["change", "click", "focus"];

  const NODES = new Map();

  /** Returns the real DOM Element corresponding to a serialized Element object. */
  function getNode(nodeOrId) {
    if (!nodeOrId) {
      return null;
    }
    if (typeof nodeOrId == "string") {
      return NODES.get(nodeOrId);
    }
    if (nodeOrId.nodeName === "BODY") {
      return document.querySelector("#root"); // TODO(willchou)
    }
    return NODES.get(nodeOrId.__id);
  }

  EVENTS_TO_PROXY.forEach(e => {
    addEventListener(e, proxyEvent, {capture: true, passive: true});
  });

  // Allow mutations up to 1s after user gesture.
  const GESTURE_TO_MUTATION_THRESHOLD = Flags.REQUIRE_GESTURE_TO_MUTATE
    ? 1000
    : Infinity;
  let timeOfLastUserGesture = Date.now();

  let touchStart;

  /**
   * @param {*} message
   */
  function postToWorker(message) {
    const eventType = message.event ? ":" + message.event.type : "";
    console.info(`Posting "${message.type + eventType}" to worker:`, message);
    worker.postMessage(message);
  }

  /** Derives {pageX,pageY} coordinates from a mouse or touch event. */
  function getTouch(e) {
    let t =
      (e.changedTouches && e.changedTouches[0]) ||
      (e.touches && e.touches[0]) ||
      e;
    return t && {pageX: t.pageX, pageY: t.pageY};
  }

  /** Forward a DOM Event into the Worker as a message */
  function proxyEvent(e) {
    timeOfLastUserGesture = Date.now();

    if (e.type === "click" && touchStart) {
      return false;
    }

    let event = {type: e.type};
    if (e.target) {
      event.target = e.target.__id;
    }

    // For change events, update worker with new `value` prop.
    // TODO(willchou): Complete support for user input (e.g. input events, other props).
    if (e.type == "change" && "value" in e.target) {
      event.__value = e.target.value;
    }

    // Copy properties from `e` to proxied `event`.
    for (let i in e) {
      let v = e[i];
      const typeOfV = typeof v;
      if (
        typeOfV !== "object" &&
        typeOfV !== "function" &&
        i !== i.toUpperCase() &&
        !event.hasOwnProperty(i)
      ) {
        event[i] = v;
      }
    }

    postToWorker({type: "event", event});

    // Recategorize very close touchstart/touchend events as clicks.
    // TODO(willchou): Unnecessary?
    if (e.type === "touchstart") {
      touchStart = getTouch(e);
    } else if (e.type === "touchend" && touchStart) {
      let touchEnd = getTouch(e);
      if (touchEnd) {
        let dist = Math.sqrt(
          Math.pow(touchEnd.pageX - touchStart.pageX, 2) +
            Math.pow(touchEnd.pageY - touchStart.pageY, 2)
        );
        if (dist < 10) {
          event.type = "click";
          postToWorker({type: "event", event});
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
    childList({
      target,
      removedNodes,
      addedNodes,
      previousSibling,
      nextSibling,
    }) {
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
          parent.insertBefore(
            newNode,
            (nextSibling && getNode(nextSibling)) || null
          );
        }
      }
    },
    attributes({target, attributeName, value, oldValue}) {
      getNode(target).setAttribute(attributeName, value);
    },
    characterData({target, value, oldValue}) {
      getNode(target).nodeValue = value;
    },
    // Non-standard MutationRecord for property changes.
    properties({target, propertyName, value, oldValue}) {
      const node = getNode(target);
      console.assert(node);
      node[propertyName] = value;
    },
  };

  let mutationTimer;
  // stores pending DOM changes (MutationRecord objects)
  let MUTATION_QUEUE = [];

  const windowSizeCache = {};
  // Check if an Element is at least partially visible
  function isElementInViewport(el, cache = windowSizeCache) {
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
  function processMutations(deadline) {
    clearTimeout(mutationTimer);

    const start = Date.now();
    const isDeadline = deadline && deadline.timeRemaining;
    let timedOut = false;

    for (let i = 0; i < MUTATION_QUEUE.length; i++) {
      if (isDeadline ? deadline.timeRemaining() <= 0 : Date.now() - start > 1) {
        timedOut = true;
        break;
      }
      const m = MUTATION_QUEUE[i];

      const latency = m.timestamp - timeOfLastUserGesture;
      if (latency > GESTURE_TO_MUTATION_THRESHOLD) {
        console.warn(
          `Mutation latency exceeded (${latency}). Queued until next gesture: `,
          m
        );
        continue;
      }

      // if the element is offscreen, skip any text or attribute changes:
      if (m.type === "characterData" || m.type === "attributes") {
        let target = getNode(m.target);
        if (target && !isElementInViewport(target)) {
          continue;
        }
      }

      // remove mutation from the queue and apply it:
      const mutation = MUTATION_QUEUE.splice(i--, 1)[0];
      MUTATIONS[mutation.type](mutation);
    }

    if (timedOut && MUTATION_QUEUE.length > 0) {
      processMutationsSoon();
    }
  }

  function processMutationsSoon() {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(processMutations, 100);
    requestIdleCallback(processMutations);
  }

  function enqueueMutation(mutation) {
    let merged = false;

    // Merge/overwrite characterData & attribute mutations instead of queueing
    // to avoid extra DOM mutations.
    // TODO(willchou): Restore this when (target == __id) is supported.
    // if (mutation.type === 'characterData' || mutation.type === 'attributes') {
    //   for (let i = MUTATION_QUEUE.length; i--; ) {
    //     let m = MUTATION_QUEUE[i];
    //     if (m.type == mutation.type && m.target.__id == mutation.target.__id) {
    //       if (m.type === 'attributes') {
    //         MUTATION_QUEUE.splice(i + 1, 0, mutation);
    //       } else {
    //         MUTATION_QUEUE[i] = mutation;
    //       }
    //       merged = true;
    //     }
    //   }
    // }

    if (!merged) {
      MUTATION_QUEUE.push(mutation);
    }

    processMutationsSoon();
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
  const aotRoot = document.querySelector("[amp-aot]");
  const metrics = document.querySelector("#metrics");

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

  function deserializeDom() {
    let domString = "";
    for (let i = 0, l = sharedArray.length; i < l; i++) {
      const b = Atomics.load(sharedArray, i);
      if (b > 0) {
        const c = String.fromCharCode(b);
        domString += c;
      } else {
        break;
      }
    }
    return JSON.parse(domString);
  }

  const buffer = new SharedArrayBuffer(Uint16Array.BYTES_PER_ELEMENT * 1000);
  const sharedArray = new Uint16Array(buffer);

  let domSkeleton = null;

  worker.onmessage = ({data}) => {
    if (metrics) {
      const latency = window.performance.now() - data.timestamp;
      metrics.textContent = latency;
    }

    console.info(`Received "${data.type}" from worker:`, data);

    switch (data.type) {
      case "init-render":
        console.assert(Flags.USE_SHARED_ARRAY_BUFFER);
        domSkeleton = deserializeDom();
        console.assert(domSkeleton.nodeName == "BODY");
        const node = createNode(domSkeleton);
        document.body.appendChild(node);
        break;

      case "dom-update":
        console.assert(domSkeleton);
        domSkeleton = deserializeDom();
        repaintDirty(domSkeleton);
        break;

      case "mutate":
        const now = Date.now();

        data.mutations.forEach(mutation => {
          mutation.timestamp = now;

          // TODO(willchou): Improve heuristic for identifying initial render.
          if (initialRender && aotRoot) {
            // Check if mutation record looks like the root containing `amp-aot` attr.
            // If so, set __id on all matching DOM elements.
            console.info("Hydrating AOT root: ", aotRoot);
            console.assert(mutation.type == "childList" && mutation.addedNodes);
            mutation.addedNodes.forEach(n => hydrate(aotRoot, n));
            return;
          } else if (initialRender) {
            console.warn("No AOT root found!");
          }

          enqueueMutation(mutation);
        });

        initialRender = false;
        break;
    }
  };

  postToWorker({
    type: "init",
    location: location.href,
    buffer,
  });
};
