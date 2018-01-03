// Install a global Document using Undom, a minimal DOM Document implementation.
let document = self.document = undom();
for (let i in document.defaultView) {
  if (document.defaultView.hasOwnProperty(i)) {
    self[i] = document.defaultView[i];
  }
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
  },
};

let history = {
  pushState(a, b, url) {
    send({type: 'pushState', url});
  },
  replaceState(a, b, url) {
    send({type: 'replaceState', url});
  },
};

let COUNTER = 0;

const TO_SANITIZE = ['addedNodes', 'removedNodes', 'nextSibling', 'previousSibling', 'target'];

// TODO(willchou): Replace this with something more generic.
const PROP_BLACKLIST = ['children', 'parentNode', '__handlers', '_component', '_componentConstructor'];

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
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  if (obj instanceof document.defaultView.Node) {
    let id = obj.__id;
    if (!id) {
      id = obj.__id = String(++COUNTER);
    }
    NODES.set(id, obj);
  }

  let out = {};
  for (let i in obj) {
    if (obj.hasOwnProperty(i) && PROP_BLACKLIST.indexOf(i) < 0) {
      out[i] = obj[i];
    }
  }
  if (out.childNodes && out.childNodes.length) {
    out.childNodes = sanitize(out.childNodes);
  }
  return out;
}

if (!Flags.BUNDLE_MUTATIONS_IN_DOM) {
  const observer = new MutationObserver((mutations) => {
    for (let i = mutations.length; i--; ) {
      let mutation = mutations[i];
      for (let j = TO_SANITIZE.length; j--; ) {
        let prop = TO_SANITIZE[j];
        mutation[prop] = sanitize(mutation[prop]);
      }
    }
    send({type: 'mutate', mutations});
  });
  observer.observe(document, {subtree: true});
}

function serializeDom() {
  if (!sharedArray) {
    return;
  }
  const serialized = sanitize(document.body);
  const string = JSON.stringify(serialized);
  let l = string.length;
  for (let i = 0; i < l; i++) {
    Atomics.store(sharedArray, i, string.charCodeAt(i));
  }
  // Erase trailing bytes in case DOM has decreased in size.
  for (let i = string.length; i < sharedArray.length; i++) {
    if (Atomics.load(sharedArray, i) > 0) {
      Atomics.store(sharedArray, i, 0);
    } else {
      break;
    }
  }
}

function onInitialRender() {
  initialRenderComplete = true;
  serializeDom();
  postMessage({type: 'init-render'});
};

function send(message) {
  const json = JSON.parse(JSON.stringify(message));
  json.timestamp = self.performance.now();
  postMessage(json);
}

let sharedArray;

addEventListener('message', ({data}) => {
  switch (data.type) {
    case 'init':
      url = data.url;
      sharedArray = new Uint16Array(data.buffer);
      if (Flags.BUNDLE_MUTATIONS_IN_DOM) {
        // HACK(willchou): Should instead wait until X ms after last DOM mutation.
        setTimeout(onInitialRender, 200);
      }
      break;
    case 'event':
      handleEvent(data.event);
      break;
  }
});