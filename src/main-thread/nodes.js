const NODES = new Map();

/**
 * Establish link between DOM `node` and worker-generated identifier `id`.
 * @param {!Node} node
 * @param {string} id
 */
export function bindNodeId(node, id) {
  node.__id = id;
  NODES.set(id, node);
}

/** 
 * Returns the real DOM Element corresponding to a serialized Element object.
 * @param {Node|string} nodeOrId
 */ 
// TODO (KB): Seperate functions for different types.
export function getNode(nodeOrId) {
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