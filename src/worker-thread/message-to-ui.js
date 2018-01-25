export function send(message) {
  // TODO: KB – via @surma, Structural Clone Performance can be improved.
  __postMessage({...JSON.parse(JSON.stringify(message)), timestamp: performance.now() || Date.now()});
}