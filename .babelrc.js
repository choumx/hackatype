module.exports = {
  presets: [
    [
      '@babel/env', {
        targets: {
          browsers: ['last 2 versions', 'ie >= 11', 'safari >= 7'],
        },
        modules: false,
        loose: true,
      }
    ],
  ],
  plugins: [
    ['@babel/plugin-proposal-object-rest-spread'],
    ['@babel/plugin-proposal-class-properties'],
    ['@babel/transform-react-jsx', {pragma: 'h', useBuiltIns: true}]
  ]
};


// "presets": [
//   "es2015-loose",
//   "stage-0"
// ],
// "plugins": [
//   ["transform-react-jsx", { "pragma":"h" }]
// ]