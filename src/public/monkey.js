/**
 * Monkey-patch WorkerGlobalScope.
 */

const monkeyScope = {
  document: undom(),
  history: {
    pushState(a, b, url) {
      send({type: "pushState", url});
    },
    replaceState(a, b, url) {
      send({type: "replaceState", url});
    },
  },
  localStorage: {},
  location: {
    _current: "/",
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
  },
  performance: self.performance,
  url: "/",
};
const undomWindow = monkeyScope.document.defaultView;
for (let i in undomWindow) {
  if (undomWindow.hasOwnProperty(i)) {
    monkeyScope[i] = undomWindow[i];
  }
}
monkeyScope.global = monkeyScope;
monkeyScope.self = monkeyScope;

/**
 * Worker communication layer.
 */

let NODE_COUNTER = 0;

const TO_SANITIZE = [
  "addedNodes",
  "removedNodes",
  "nextSibling",
  "previousSibling",
  "target",
];

// TODO(willchou): Replace this with something more generic.
const PROP_BLACKLIST = [
  "children",
  "parentNode",
  "__handlers",
  "_component",
  "_componentConstructor",
];

const NODES = new Map();

function getNode(node) {
  let id;
  if (node && typeof node === "object") {
    id = node.__id;
  }
  if (typeof node === "string") {
    id = node;
  }
  if (!id) {
    return null;
  }
  if (node.nodeName === "BODY") {
    return document.body;
  }
  const n = NODES.get(id);
  return n;
}

function handleEvent(event) {
  let target = getNode(event.target);
  if (target) {
    // Update worker DOM with user changes to <input> etc.
    if ("__value" in event) {
      target.value = event.__value;
    }
    event.target = target;
    event.bubbles = true;
    target.dispatchEvent(event);
  }
}

function sanitize(obj) {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  if (obj instanceof monkeyScope.document.defaultView.Node) {
    let id = obj.__id;
    if (!id) {
      id = obj.__id = String(++NODE_COUNTER);
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

if (!Flags.USE_SHARED_ARRAY_BUFFER) {
  const observer = new monkeyScope.MutationObserver(mutations => {
    for (let i = mutations.length; i--; ) {
      let mutation = mutations[i];
      for (let j = TO_SANITIZE.length; j--; ) {
        let prop = TO_SANITIZE[j];
        mutation[prop] = sanitize(mutation[prop]);
      }
    }
    send({type: "mutate", mutations});
  });
  observer.observe(monkeyScope.document, {subtree: true});
}


function onInitialRender() {
  initialRenderComplete = true;
  postMessage({type: "init-render"});
}

function send(message) {
  const json = JSON.parse(JSON.stringify(message));
  json.timestamp = self.performance.now();
  postMessage(json);
}

let sharedArray;

addEventListener("message", ({data}) => {
  switch (data.type) {
    case "init":
      url = data.url;
      break;
    case "event":
      handleEvent(data.event);
      break;
  }
});
