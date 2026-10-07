/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: 'test/.*\.spec\.ts$',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  setupFiles: ['<rootDir>/test/env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  testTimeout: 60000,
};
