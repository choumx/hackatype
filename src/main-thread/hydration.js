import {bindNodeId} from './nodes.js';

export function hydrate(root, hydrations) {
  for (let hydration of hydrations) {
    // Check if mutation record ('hydration') looks like the root containing `amp-aot` attr.
    // If so, set __id on all matching DOM elements.
    console.info('Hydrating root: ', root);
    console.assert(hydration.type == 'childList' && hydration.addedNodes);
    for (let nodeToAdd of hydration.addedNodes) {
      hydrateNode(root, nodeToAdd); 
    }
  }
}

/**
 * Recursively hydrates AOT rendered `node` with corresponding worker `skeleton`.
 * @param {!Node} node
 * @param {!Object} skeleton
 */
function hydrateNode(node, skeleton) {
  assertMatchesSkeleton(node, skeleton);
  bindNodeId(node, skeleton.__id);

  for (let i = 0; i < skeleton.childNodes.length; i++) {
    hydrateNode(node.childNodes[i], skeleton.childNodes[i]);
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