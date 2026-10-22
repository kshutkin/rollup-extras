import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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

    it.each([true, false])('should respect excludes and nested directory symlinks (followSymlinks: %s)', async followSymlinks => {
        await mkdir(join(tmpDir, 'real', 'nested'), { recursive: true });
        await writeFile(join(tmpDir, 'real', 'nested', 'keep.txt'), 'keep');
        await writeFile(join(tmpDir, 'real', 'nested', 'skip.txt'), 'skip');
        await symlink('real/nested', join(tmpDir, 'linked'));

        const result = await globFiles(join(tmpDir, '**/*'), join(tmpDir, '**/skip.txt'), followSymlinks);
        expect(result).toContain(join(tmpDir, 'real', 'nested', 'keep.txt'));
        expect(result.some(file => file.endsWith('skip.txt'))).toBe(false);
        expect(result.includes(join(tmpDir, 'linked', 'keep.txt'))).toBe(followSymlinks);
    });

    it('should allow an explicitly named directory symlink when followSymlinks is false', async () => {
        await mkdir(join(tmpDir, 'real'));
        await writeFile(join(tmpDir, 'real', 'file.txt'), 'content');
        await symlink('real', join(tmpDir, 'linked'));

        expect(await globFiles(join(tmpDir, 'linked', '*.txt'), undefined, false)).toEqual([join(tmpDir, 'linked', 'file.txt')]);
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
