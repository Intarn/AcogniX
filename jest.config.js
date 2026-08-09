module.exports = {
  testEnvironment: 'node',

  clearMocks: true,

  testMatch: [
    '<rootDir>/backend/tests/**/*.test.js'
  ],

  collectCoverageFrom: [
    '<rootDir>/backend/controllers/**/*.js',
    '<rootDir>/backend/service/**/*.js',
    '<rootDir>/backend/entities/**/*.js',
    '<rootDir>/backend/middleware/**/*.js',
    '!**/node_modules/**'
  ]
};