module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,
  detectOpenHandles: true,
  runInBand: true,
  globalTeardown: '<rootDir>/database/teardown.js',
};