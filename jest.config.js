module.exports = {
  // preset: 'ts-jest'
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest"],
  },
  testEnvironment: "node", // Crucial for backend/server-side tests
  roots: ["<rootDir>/src"], // Where Jest should look for tests and source files
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/?(*.)+(spec|test).+(ts|tsx|js)",
    "**/*.integration.test.ts",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Optional: Collect coverage (uncomment and configure if needed later)
  // collectCoverage: true,
  // coverageDirectory: "coverage",
  // collectCoverageFrom: [
  //   "src/**/*.ts",
  //   "!src/**/*.test.ts",
  //   "!src/**/*.integration.test.ts",
  //   "!src/server/__mocks__/**", // Exclude mocks
  //   "!src/common/types.ts" // Exclude type definition files if they contain no logic
  // ],

  // Optional: If you use path aliases in tsconfig.json, you'll need moduleNameMapper
  // moduleNameMapper: {
  //   '^@/(.*)$': '<rootDir>/src/$1',
  // },

  // Optional: Clear mocks between every test
  clearMocks: true,

  // Increase default timeout for tests if your API calls are slow
  testTimeout: 20000,
};
