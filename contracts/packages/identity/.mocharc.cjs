// Tests run through ts-node with the test tsconfig, which adds Node and Mocha
// types on top of the browser-only library config.
process.env.TS_NODE_PROJECT = require('node:path').join(__dirname, 'test/tsconfig.json')

module.exports = {
  require: ['ts-node/register'],
  extension: ['ts'],
  spec: ['test/**/*.test.ts'],
  timeout: 60000,
}
