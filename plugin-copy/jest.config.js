export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    testMatch: ['<rootDir>/**/tests/**/*.spec.ts'],
    testPathIgnorePatterns: ['/node_modules/'],
    coverageDirectory: './coverage',
    coveragePathIgnorePatterns: ['node_modules', 'src/tests'],
    moduleNameMapper: {
        '@rollup-extras/(.*)/(.*)': '<rootDir>/../$1/src/$2.ts',
        '@rollup-extras/(.*)$': '<rootDir>/../$1/src',
    },
    transform: {
        '\\.ts$': ['ts-jest', {
            useESM: true
        }]
    }
};