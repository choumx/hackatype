import {getNode, bindNodeId} from './nodes.js';

export function childList({target, removedNodes, addedNodes, nextSibling}) {
  let parent = getNode(target);
  if (removedNodes) {
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
    }
  }
}

export function attributes(mutation) {
  getNode(mutation.target).setAttribute(mutation.attributeName, mutation.value);
}

export function characterData(mutation) {
  getNode(mutation.target).nodeValue = mutation.value;
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