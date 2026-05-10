export default {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],
  collectCoverageFrom: ["src/**/*.js"],
  testMatch: ["**/tests/**/*.test.js"],
};
