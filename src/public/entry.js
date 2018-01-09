import renderer from './renderer.js';

Promise.all([
  fetch('undom.js').then((response) => response.text()),
  fetch('monkey.js').then((response) => response.text()),
  fetch('app.js').then((response) => response.text()),
]).then(([undom, monkey, app]) => {
  const globalEscapesCheck =
      `(function() {
        try {
          const g = Function("return this")() || (0, eval)("this"); // CSP should disallow this.
          console.assert(!g);
        } catch (e) {}
        const f = (function() { return this })(); // Strict mode should disallow this.
        console.assert(!f);
      })();`;

  // `with()` not allowed in strict mode.
  const monkeyGlobal =
      `const self = this;
      const document = this.document;
      const Node = this.Node;
      const Text = this.Text;
      const Element = this.Element;
      const SVGElement = this.SVGElement;
      const Document = this.Document;
      const Event = this.Event;
      const MutationObserver = this.MutationObserver;`;

  // TODO(willchou): Write runtime check that class globals like
  // `WorkerGlobalScope` and `XmlHttpRequest` are not available.

  const code = [
    undom,
    monkey,
    '(function() {', // Set `this` to `monkeyScope`.
      globalEscapesCheck,
      monkeyGlobal,
      app,
    '}).call(monkeyScope);',
  ].join('\n');

  const blob = new Blob([code]);
  const worker = new Worker(URL.createObjectURL(blob), {type: 'module'}); // `module` doesn't work in Chrome yet (crbug/680046).
  renderer({worker});
});
