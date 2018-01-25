import renderer from './main-thread/renderer.js';

Promise.all([
  fetch('worker-thread/monkey.js').then(response => response.text()),
  fetch('author/app.js').then(response => response.text()),
]).then(([monkey, app]) => {
  // Checks tricky ways to get the global scope.
  const globalEscapesCheck = `
      (function() {
        try {
          console.assert(!(Function("return this")())); // CSP should disallow this.
        } catch (e) {}
        try {
          console.assert(!((0, eval)("this"))); // CSP should disallow this.
        } catch (e) {}
        const f = (function() { return this })(); // Strict mode should disallow this.
        console.assert(!f);
      })();`;

  // `with()` not allowed in strict mode.
  const monkeyGlobal = `
      const self = this;
      const document = this.document;
      const Node = this.Node;
      const Text = this.Text;
      const Element = this.Element;
      const SVGElement = this.SVGElement;
      const Document = this.Document;
      const Event = this.Event;
      const MutationObserver = this.MutationObserver;`;

  // Check that class globals are not available.
  const classGlobalsCheck = `
      try { console.assert(!WorkerGlobalScope); } catch (e) {
        console.assert(e.message == 'WorkerGlobalScope is not defined');
      }
      try { console.assert(!DedicatedWorkerGlobalScope); } catch (e) {
        console.assert(e.message == 'DedicatedWorkerGlobalScope is not defined');
      }
      try { console.assert(!XmlHttpRequest); } catch (e) {
        console.assert(e.message == 'XmlHttpRequest is not defined');
      }`;

  const code = [
    monkey,
    '(function() {', // Set `this` to `monkeyScope`.
      globalEscapesCheck,
      monkeyGlobal,
      classGlobalsCheck,
      app,
    '}).call(monkeyScope);',
  ].join('\n');

  const blob = new Blob([code]);
  const worker = new Worker(URL.createObjectURL(blob), {type: 'module'}); // `module` doesn't work in Chrome yet (crbug/680046).
  renderer({worker});
});
