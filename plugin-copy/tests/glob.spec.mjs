import { describe, expect, it } from 'vitest';

import { globParent } from '../src/glob.js';

describe('globParent', () => {
    it('should return parent directory for glob pattern', () => {
        expect(globParent('assets/**/*.json')).toBe('assets');
    });

    it('should return nested parent directory for glob pattern', () => {
        expect(globParent('src/assets/**/*.json')).toBe('src/assets');
    });

    it('should return "." for pattern starting with wildcard', () => {
        expect(globParent('*.json')).toBe('.');
    });

    it('should return "." for double wildcard at start', () => {
        expect(globParent('**/*.json')).toBe('.');
    });

    it('should return parent directory for literal file path', () => {
        expect(globParent('src/test.css')).toBe('src');
    });

    it('should return nested parent directory for literal file path', () => {
        expect(globParent('src/test/index.html')).toBe('src/test');
    });

    it('should return "." for literal file without directory', () => {
        expect(globParent('test.css')).toBe('.');
    });

    it('should handle pattern with question mark glob', () => {
        expect(globParent('src/test?.css')).toBe('src');
    });

    it('should handle pattern with bracket glob', () => {
        expect(globParent('src/[abc].css')).toBe('src');
    });

    it('should handle pattern with brace glob', () => {
        expect(globParent('src/{a,b}.css')).toBe('src');
    });

    it('should handle pattern with negation glob', () => {
        expect(globParent('src/!(a).css')).toBe('src');
    });
});
