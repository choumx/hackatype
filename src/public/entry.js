import renderer from './renderer.js';

Promise.all([
  fetch('undom.js').then((response) => response.text()),
  fetch('monkey.js').then((response) => response.text()),
  fetch('app.js').then((response) => response.text()),
]).then(([undom, monkey, app]) => {

  const trickyGlobal =
      `(function() {
        try {
          const g = Function("return this")() || (0, eval)("this"); // CSP should disallow this.
          console.assert(!g);
        } catch (e) {}
        const f = (function() { return this })(); // Strict mode should disallow this.
        console.assert(!f);
      })();`;

  const code = [
    undom,
    monkey,
    '(function() {', // Set `this` to `monkeyScope`.
    '  with (monkeyScope) {', // Shadow global vars e.g. `self`.
        trickyGlobal,
        app,
    '  }',
    '}).call(monkeyScope);',
  ].join('\n');

  const blob = new Blob([code]);
  const worker = new Worker(URL.createObjectURL(blob), {type: 'module'}); // `module` doesn't work in Chrome yet (crbug/680046).
  renderer({worker});
});
