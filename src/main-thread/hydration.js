import {hydrateNode} from './nodes.js';

export function hydrateDOM(root, hydrations) {
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