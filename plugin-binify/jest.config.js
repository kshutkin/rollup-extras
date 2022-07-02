import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('package.json').toString());
const scopeTest = /(@.+)\/.+$/g.exec(pkg.name);
let scope = undefined;
let moduleNameMapper = {};
if (scopeTest && scopeTest[0]) {
    scope = scopeTest[1];
    moduleNameMapper[`${scope}/(.*)/(.*)`] = '<rootDir>/../$1/src/$2.ts';
    moduleNameMapper[`${scope}/(.*)$`] = '<rootDir>/../$1/src';
}

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    testMatch: ['<rootDir>/**/tests/**/*.spec.ts'],
    globals: {
        'ts-jest': {
            useESM: true,
        },
    },
    testPathIgnorePatterns: ['/node_modules/'],
    coverageDirectory: './coverage',
    coveragePathIgnorePatterns: ['node_modules', 'src/tests'],
    moduleNameMapper
};