const path = require('path');

module.exports = function(options) {
  return {
    ...options,
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'main.js',
    },
    externals: [],
  };
};
