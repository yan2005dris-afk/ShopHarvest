/** Jest configuration for the ETL worker package. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  // Scan both src/ (unit tests) and the package root (tsconfig.test.ts).
  // tsconfig.test.ts lives at worker/tsconfig.test.ts so it asserts the
  // package-level tsconfig without being a "production" src file.
  roots: ['<rootDir>', '<rootDir>/..'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testRegex: '.*\\.(test|spec)\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Redirect any `import 'playwright'` in the test's module graph (including
  // pipeline's local copy) to a deterministic manual mock. Required because
  // pipeline/ has its own playwright in pipeline/node_modules, which a plain
  // jest.mock('playwright') in the test file would NOT intercept.
  moduleNameMapper: {
    '^playwright$': '<rootDir>/../__mocks__/playwright.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  // Each test gets a clean env so config validation has deterministic inputs.
  clearMocks: true,
};