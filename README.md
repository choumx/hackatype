### Quick Start

```sh
git clone git@github.com:choumx/hackatype.git
cd hackatype
npm install
npm start
```

### Notes

- `app.js` contains a few React components -- switch between them at the bottom of the file
- The top of `renderer.js` and `undom.js` contain feature flags
    - `USE_SHARED_ARRAY_BUFFER` currently only works with the "Timer" component
- `package.json` (and the rest of this repo) is a bit of a mess
