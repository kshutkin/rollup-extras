import globParent from 'glob-parent';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { globFiles } from '../src/glob.js';

describe('globFiles', () => {
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'glob-test-'));
        await writeFile(join(tmpDir, 'a.txt'), 'a');
        await writeFile(join(tmpDir, 'b.txt'), 'b');
        await writeFile(join(tmpDir, 'c.json'), '{}');
    });

    afterEach(async () => {
        if (tmpDir) {
            await rm(tmpDir, { recursive: true, force: true });
        }
    });

    it('should return matching files when called without exclude', async () => {
        const result = await globFiles(join(tmpDir, '*.txt'));
        expect(result).toHaveLength(2);
        expect(result.sort()).toEqual([join(tmpDir, 'a.txt'), join(tmpDir, 'b.txt')]);
    });

    it('should return matching files when exclude is undefined', async () => {
        const result = await globFiles(join(tmpDir, '*'), undefined);
        expect(result).toHaveLength(3);
    });

    it('should return empty array when no files match and exclude is omitted', async () => {
        const result = await globFiles(join(tmpDir, '*.css'));
        expect(result).toEqual([]);
    });
});

describe('globFiles with exclude', () => {
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'glob-excl-'));
        await writeFile(join(tmpDir, 'a.txt'), 'a');
        await writeFile(join(tmpDir, 'b.txt'), 'b');
        await writeFile(join(tmpDir, 'c.json'), '{}');
    });

    afterEach(async () => {
        if (tmpDir) {
            await rm(tmpDir, { recursive: true, force: true });
        }
    });

    it('should exclude files matching a string exclude pattern', async () => {
        const result = await globFiles(join(tmpDir, '*'), join(tmpDir, '*.json'));
        expect(result).toHaveLength(2);
        expect(result.sort()).toEqual([join(tmpDir, 'a.txt'), join(tmpDir, 'b.txt')]);
    });

    it('should exclude files matching an array of exclude patterns', async () => {
        const result = await globFiles(join(tmpDir, '*'), [join(tmpDir, '*.json'), join(tmpDir, 'b.*')]);
        expect(result).toHaveLength(1);
        expect(result).toEqual([join(tmpDir, 'a.txt')]);
    });
});
