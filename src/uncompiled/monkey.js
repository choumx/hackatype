// Install a global Document using Undom, a minimal DOM Document implementation.
let document = self.document = undom();
for (let i in document.defaultView) if (document.defaultView.hasOwnProperty(i)) {
  self[i] = document.defaultView[i];
}

let localStorage = {};

let url = '/';

let location = {
  _current: '/',
  get href() {
    return url;
  },
  get pathname() {
    return null;
  },
  get search() {
    return null;
  },
  get hash() {
    return null;
  }
};

let history = {
  pushState(a, b, url) {
    send({ type:'pushState', url });
  },
  replaceState(a, b, url) {
    send({ type:'replaceState', url });
  }
};

let COUNTER = 0;

const TO_SANITIZE = ['addedNodes', 'removedNodes', 'nextSibling', 'previousSibling', 'target'];

const PROP_BLACKLIST = ['children', 'parentNode', '__handlers', '_component', '_componentConstructor' ];

const NODES = new Map();

function getNode(node) {
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

function handleEvent(event) {
  let target = getNode(event.target);
  if (target) {
    // Update worker DOM with user changes to <input> etc.
    if ('__value' in event) {
      target.value = event.__value;
    }
    event.target = target;
    event.bubbles = true;
    target.dispatchEvent(event);
  }
}

function sanitize(obj) {
  if (!obj || typeof obj!=='object') return obj;

  if (Array.isArray(obj)) return obj.map(sanitize);

  if (obj instanceof document.defaultView.Node) {
    let id = obj.__id;
    if (!id) {
      id = obj.__id = String(++COUNTER);
    }
    NODES.set(id, obj);
  }

  let out = {};
  for (let i in obj) {
    if (obj.hasOwnProperty(i) && PROP_BLACKLIST.indexOf(i)<0) {
      out[i] = obj[i];
    }
  }
  if (out.childNodes && out.childNodes.length) {
    out.childNodes = sanitize(out.childNodes);
  }
  return out;
}

(new MutationObserver( mutations => {
  for (let i=mutations.length; i--; ) {
    let mutation = mutations[i];
    for (let j=TO_SANITIZE.length; j--; ) {
      let prop = TO_SANITIZE[j];
      mutation[prop] = sanitize(mutation[prop]);
    }
  }
  send({ type:'MutationRecord', mutations });
})).observe(document, { subtree:true });

function send(message) {
  const json = JSON.parse(JSON.stringify(message));
  postMessage(json);
}

let array; // Testing SAB.

addEventListener('message', ({ data }) => {
  switch (data.type) {
    case 'init':
      url = data.url;

      // Testing SAB.
      array = new Int32Array(data.buffer);
      console.log('Worker received buffer with: ' + array[0]);
      console.log('Changing value to 777...');
      Atomics.store(array, 0, 777);
      break;
    case 'event':
      handleEvent(data.event);
      break;
  }
});
