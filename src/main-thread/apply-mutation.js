import {getNode, bindNodeId} from './nodes.js';

export function childList({target, removedNodes, addedNodes, nextSibling}) {
  let parent = getNode(target);
  if (removedNodes) {
<<<<<<< HEAD
    let iterator = removedNodes.length;
    for (;iterator--;) {
      parent.removeChild(getNode(removedNodes[iterator]));
    }
  }
  if (addedNodes) {
    let iterator = 0;
    let length = addedNodes.length;

    for (; iterator < length; iterator++) {
      parent.insertBefore(getNode(addedNodes[iterator]) || createNode(addedNodes[iterator]), nextSibling && getNode(nextSibling) || null);
=======
    for (let i = removedNodes.length; i--;) {
      parent.removeChild(getNode(removedNodes[i]));
    }
  }
  if (addedNodes) {
    for (let addedNode of addedNodes) {
      let newNode = getNode(addedNode);
      if (!newNode) {
        newNode = createNode(addedNode);
      }
      parent.insertBefore(newNode, nextSibling && getNode(nextSibling) || null);
>>>>>>> e4849255d576715d1912cd658ec4f94f22188483
    }
  }
}

export function attributes(mutation) {
  getNode(mutation.target).setAttribute(mutation.attributeName, mutation.value);
}

export function characterData(mutation) {
<<<<<<< HEAD
  getNode(mutation.target).textContent = mutation.value;
=======
  getNode(mutation.target).nodeValue = mutation.value;
>>>>>>> e4849255d576715d1912cd658ec4f94f22188483
}

// Non-standard MutationRecord for property changes.
export function properties(mutation) {
  const node = getNode(mutation.target);
  node[mutation.propertyName] = mutation.value;
}

/** Create a real DOM Node from a skeleton Object (`{ nodeType, nodeName, attributes, children, data }`)
 * @example <caption>Text node</caption>
 *   createNode({ nodeType:3, data:'foo' })
 * @example <caption>Element node</caption>
 *   createNode({ nodeType:1, nodeName:'div', attributes:[{ name:'a', value:'b' }], childNodes:[ ... ] })
 */
function createNode(skeleton) {
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