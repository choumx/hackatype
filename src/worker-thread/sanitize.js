import {setNode} from './nodes.js';

// TODO(willchou): Replace this with something more generic.
const PROP_BLACKLIST = ['children', 'parentNode', '__handlers', '_component', '_componentConstructor'];

export function sanitize(document, obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(arrayMemberObject => sanitize(document, arrayMemberObject));
  }

  if (obj instanceof document.defaultView.Node) {
    let id = obj.__id;
    if (!id) {
      obj.__id = setNode(obj);
    }
  }

  let out = {};
  for (let i in obj) {
    if (obj.hasOwnProperty(i) && PROP_BLACKLIST.indexOf(i) < 0) {
      out[i] = obj[i];
    }
  }
  if (out.childNodes && out.childNodes.length) {
    out.childNodes = sanitize(document, out.childNodes);
  }
  return out;
}