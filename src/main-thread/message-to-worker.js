
/**
 * @param {*} message
 */
export function messageToWorker(worker, message) {
  const eventType = (message.event ? ':' + message.event.type : '');
  console.info(`Posting "${message.type + eventType}" to worker:`, message);
  worker.postMessage(message);
}