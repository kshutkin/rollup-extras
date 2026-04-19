import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
