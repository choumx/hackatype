
/**
 * @param {*} message
 */
export function postToWorker(worker, message) {
  const eventType = (message.event ? ':' + message.event.type : '');
  console.info(`Posting "${message.type + eventType}" to worker:`, message);
  worker.postMessage(message);
}