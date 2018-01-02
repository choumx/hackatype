import renderer from './renderer.js';

Promise.all([
  fetch('undom.js').then((response) => response.text()),
  fetch('monkey.js').then((response) => response.text()),
  fetch('app.js').then((response) => response.text()),
]).then(([undom, monkey, app]) => {
  const code = [undom, monkey, app].join('\n');
  const blob = new Blob([code]);
  const worker = new Worker(URL.createObjectURL(blob));
  renderer({worker});
});
