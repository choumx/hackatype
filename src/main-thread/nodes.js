const NODES = new Map();

/**
 * Establish link between DOM `node` and worker-generated identifier `id`.
 * @param {!Node} node
 * @param {string} id
 */
function bindNodeId(node, id) {
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

/**
 * Recursively hydrates AOT rendered `node` with corresponding worker `skeleton`.
 * @param {!Node} node
 * @param {!Object} skeleton
 */
export function hydrateNode(node, skeleton) {
  console.assert(node.nodeType == skeleton.nodeType);
  console.assert(node.nodeName == skeleton.nodeName);
  console.assert(node.childNodes.length == skeleton.childNodes.length);
  console.assert(!node.__id && skeleton.__id);

  bindNodeId(node, skeleton.__id);
  for (let i = 0; i < skeleton.childNodes.length; i++) {
    hydrateNode(node.childNodes[i], skeleton.childNodes[i]);
  }
}

/** Create a real DOM Node from a skeleton Object (`{ nodeType, nodeName, attributes, children, data }`)
 * @example <caption>Text node</caption>
 *   createNode({ nodeType:3, data:'foo' })
 * @example <caption>Element node</caption>
 *   createNode({ nodeType:1, nodeName:'div', attributes:[{ name:'a', value:'b' }], childNodes:[ ... ] })
 */
export function createNode(skeleton) {
  if (skeleton.nodeType === Node.TEXT_NODE) {
    const node = document.createTextNode(skeleton.data);
    bindNodeId(node, skeleton.__id);
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
  bindNodeId(node, skeleton.__id);
  return node;
}