import * as Mutators from './main-thread/apply-mutation.js';
import {hydrate} from './main-thread/hydration.js';
import {listenForEvents} from './main-thread/dom-events.js';
import {postToWorker} from './main-thread/message-to-worker.js';

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
  const getLastGestureTime = listenForEvents(worker);

  // Allow mutations up to 5s after user gesture.
  const GESTURE_TO_MUTATION_THRESHOLD = Flags.REQUIRE_GESTURE_TO_MUTATE ? 5000 : Infinity;

  // stores pending DOM changes (MutationRecord objects)
  let MUTATION_QUEUE = [];

  // Flush all the MutationRecords from the queue.
  function processMutationsSync() {
    let removed = 0;
    for (let mutation of MUTATION_QUEUE) {
      Mutators[mutation.type](mutation);
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
      Mutators[mutation.type](mutation);
      removed++;

      if (isDeadline && deadline.timeRemaining() <= 0) {
        console.warn('RequestIdleCallback timeRemaining <= 0', removed);
        break;
      } else if (!isDeadline && (performance.now() - start) > 1) {
        break;
      } else if (mutation.timestamp - getLastGestureTime() > GESTURE_TO_MUTATION_THRESHOLD) {
        console.warn(`Mutation latency exceeded. Queued until next gesture: `, m);
        break;
      }
    }

    MUTATION_QUEUE.splice(0, removed);
    if (removed < mutationLenth) {
      requestIdleCallback(processMutationsAsync);
    }
  }

  const aotRoot = document.querySelector('[amp-aot]');
  const metrics = document.querySelector('#metrics');
  worker.onmessage = ({data}) => {
    if (metrics) {
      const latency = window.performance.now() - data.timestamp;
      metrics.textContent = latency;
    }

    // console.info(`Received "${data.type}" from worker:`, data);
    if (data.type === 'mutate') {
      MUTATION_QUEUE = MUTATION_QUEUE.concat(data.mutations);
      // if (async) requestIdleCallback(processMutationsAsync);
      // else setTimeout(processMutations);
      requestAnimationFrame(processMutationsSync);
    } else if (data.type === 'hydrate') {
      if (!aotRoot) {
        console.warn('AOT root missing.');
        return;
      }

      hydrate(aotRoot, data.mutations); 
    }
    
  };

  postToWorker(worker, {
    type: 'init',
    location: location.href,
  });
};
