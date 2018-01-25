import {mutateDOM} from './mutation.js';
import {hydrateDOM} from './hydration.js';
import {listenForEvents} from './dom-events.js';
import {messageToWorker} from './message-to-worker.js';

/**
 * Sets up a bidirectional DOM Mutation+Event proxy to a Workerized app.
 * @param {Worker} opts.worker The WebWorker instance to proxy to.
 */
export default ({worker}) => {
  const getLastGestureTime = listenForEvents(worker);
  const aotRoot = document.querySelector('[amp-aot]');
  const metrics = document.querySelector('#metrics');

  worker.onmessage = ({data}) => {
    if (metrics) {
      const latency = window.performance.now() - data.timestamp;
      metrics.textContent = latency;
    }

    switch(data.type) {
      case 'mutate':
        mutateDOM(getLastGestureTime(), data.mutations);
        break;
      case 'hydrate':
        if (!aotRoot) {
          console.warn('AOT root missing.');
          return;
        }
        hydrateDOM(aotRoot, data.mutations);
        break;
    }
  };

  messageToWorker(worker, {
    type: 'init',
    location: location.href,
  });
};
