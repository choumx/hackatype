let NODE_COUNTER = 0;
const NODES = new Map();

export function getNode(node) {
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

export function setNode(obj) {
  NODES.set(String(++NODE_COUNTER), obj);
  return NODE_COUNTER;
}