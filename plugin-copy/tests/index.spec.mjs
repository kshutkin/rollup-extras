import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollup } from 'rollup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import copy from '../src/index.js';

function virtual(modules) {
    return {
        name: 'virtual-input',
        resolveId(id) {
            if (modules[id]) return id;
        },
        load(id) {
            if (modules[id]) return modules[id];
        },
    };
}

describe('@rollup-extras/plugin-copy integration', () => {
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'copy-test-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should copy a single file to the output directory', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'dist');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'asset.txt'), 'hello world');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, 'asset.txt') })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('asset.txt');
        const content = await readFile(join(outDir, 'asset.txt'), 'utf8');
        expect(content).toBe('hello world');
    });

    it('should copy a file into a dest subdirectory', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'dist');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'style.css'), 'body {}');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, 'style.css'), dest: 'assets' })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const assetsDir = join(outDir, 'assets');
        const files = await readdir(assetsDir);
        expect(files).toContain('style.css');
        const content = await readFile(join(assetsDir, 'style.css'), 'utf8');
        expect(content).toBe('body {}');
    });

    it('should copy files matching a glob pattern', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'dist');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'a.txt'), 'aaa');
        await writeFile(join(srcDir, 'b.txt'), 'bbb');
        await writeFile(join(srcDir, 'c.json'), '{}');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, '*.txt') })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('a.txt');
        expect(files).toContain('b.txt');
        expect(files).not.toContain('c.json');
    });

    it('should flatten nested directory structure when flatten is true', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'dist');
        const nestedDir = join(srcDir, 'sub', 'deep');
        await mkdir(nestedDir, { recursive: true });
        await writeFile(join(srcDir, 'top.txt'), 'top');
        await writeFile(join(nestedDir, 'nested.txt'), 'nested');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, '**/*.txt'), flatten: true })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('top.txt');
        expect(files).toContain('nested.txt');
        // They should be flat at the root, not in subdirectories
        expect(files).not.toContain('sub');
    });

    it('should directly copy files when emitFiles is false', async () => {
        const srcDir = join(tmpDir, 'src');
        const destDir = join(tmpDir, 'copied');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'data.txt'), 'direct copy');

        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 1' }),
                copy({ src: join(srcDir, 'data.txt'), dest: destDir, emitFiles: false, outputPlugin: false }),
            ],
        });
        // With emitFiles: false the hook is buildEnd, so write triggers it
        await bundle.write({ format: 'es', dir: join(tmpDir, 'dist') });
        await bundle.close();

        const files = await readdir(destDir);
        expect(files).toContain('data.txt');
        const content = await readFile(join(destDir, 'data.txt'), 'utf8');
        expect(content).toBe('direct copy');
    });

    it('should handle multiple targets', async () => {
        const srcDir1 = join(tmpDir, 'src1');
        const srcDir2 = join(tmpDir, 'src2');
        const outDir = join(tmpDir, 'dist');
        await mkdir(srcDir1, { recursive: true });
        await mkdir(srcDir2, { recursive: true });
        await writeFile(join(srcDir1, 'file1.txt'), 'one');
        await writeFile(join(srcDir2, 'file2.txt'), 'two');

        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 1' }),
                copy({
                    targets: [{ src: join(srcDir1, 'file1.txt') }, { src: join(srcDir2, 'file2.txt'), dest: 'other' }],
                }),
            ],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const rootFiles = await readdir(outDir);
        expect(rootFiles).toContain('file1.txt');

        const otherFiles = await readdir(join(outDir, 'other'));
        expect(otherFiles).toContain('file2.txt');
    });

    it('should produce hashed file names when exactFileNames is false', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'dist');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'icon.txt'), 'icon-content');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, 'icon.txt'), exactFileNames: false })],
        });
        await bundle.write({ format: 'es', dir: outDir, assetFileNames: '[name]-[hash][extname]' });
        await bundle.close();

        const files = await readdir(outDir);
        // With exactFileNames false, rollup uses name field and applies assetFileNames pattern
        // so the file should have a hash in the name, not be exactly icon.txt
        const assetFile = files.find(f => f.startsWith('icon-') && f.endsWith('.txt'));
        expect(assetFile).toBeDefined();
        expect(assetFile).not.toBe('icon.txt');

        const content = await readFile(join(outDir, assetFile), 'utf8');
        expect(content).toBe('icon-content');
    });

    it('should copy files using string shorthand', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'dist');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'a.txt'), 'alpha');
        await writeFile(join(srcDir, 'b.txt'), 'bravo');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy(join(srcDir, '*.txt'))],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('a.txt');
        expect(files).toContain('b.txt');
    });

    it('should copy files using array shorthand', async () => {
        const srcDir1 = join(tmpDir, 'srcA');
        const srcDir2 = join(tmpDir, 'srcB');
        const outDir = join(tmpDir, 'dist');
        await mkdir(srcDir1, { recursive: true });
        await mkdir(srcDir2, { recursive: true });
        await writeFile(join(srcDir1, 'x.txt'), 'txt-content');
        await writeFile(join(srcDir2, 'y.css'), 'css-content');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy([join(srcDir1, '*.txt'), join(srcDir2, '*.css')])],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('x.txt');
        expect(files).toContain('y.css');
    });

    it('should copy multiple files when src is an array in a single target', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'dist');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'a.txt'), 'aaa');
        await writeFile(join(srcDir, 'b.txt'), 'bbb');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: [join(srcDir, 'a.txt'), join(srcDir, 'b.txt')] })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('a.txt');
        expect(files).toContain('b.txt');
        expect(await readFile(join(outDir, 'a.txt'), 'utf8')).toBe('aaa');
        expect(await readFile(join(outDir, 'b.txt'), 'utf8')).toBe('bbb');
    });

    it('should exclude files matching the exclude option', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'dist');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'keep.txt'), 'keep');
        await writeFile(join(srcDir, 'data.json'), '{}');
        await writeFile(join(srcDir, 'debug.log'), 'log-data');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, '*'), exclude: join(srcDir, '*.log') })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('keep.txt');
        expect(files).toContain('data.json');
        expect(files).not.toContain('debug.log');
    });

    it('should preserve nested directory structure when flatten is false (default)', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'dist');
        const nestedDir = join(srcDir, 'sub', 'deep');
        await mkdir(nestedDir, { recursive: true });
        await writeFile(join(srcDir, 'top.txt'), 'top');
        await writeFile(join(nestedDir, 'nested.txt'), 'nested');

        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 1' }),
                // flatten defaults to false, so directory structure should be preserved
                copy({ src: join(srcDir, '**/*.txt') }),
            ],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        // top.txt should be at root of output
        const rootFiles = await readdir(outDir);
        expect(rootFiles).toContain('top.txt');
        // nested.txt should be inside sub/deep/ preserving directory structure
        const deepFiles = await readdir(join(outDir, 'sub', 'deep'));
        expect(deepFiles).toContain('nested.txt');
        expect(await readFile(join(outDir, 'sub', 'deep', 'nested.txt'), 'utf8')).toBe('nested');
    });

    it('should directly copy multiple files when emitFiles is false', async () => {
        const srcDir = join(tmpDir, 'src');
        const destDir = join(tmpDir, 'copied');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'one.txt'), 'first');
        await writeFile(join(srcDir, 'two.txt'), 'second');
        await writeFile(join(srcDir, 'three.txt'), 'third');

        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 1' }),
                copy({ src: join(srcDir, '*.txt'), dest: destDir, emitFiles: false, outputPlugin: false }),
            ],
        });
        await bundle.write({ format: 'es', dir: join(tmpDir, 'dist') });
        await bundle.close();

        const files = await readdir(destDir);
        expect(files).toContain('one.txt');
        expect(files).toContain('two.txt');
        expect(files).toContain('three.txt');
        expect(await readFile(join(destDir, 'one.txt'), 'utf8')).toBe('first');
        expect(await readFile(join(destDir, 'two.txt'), 'utf8')).toBe('second');
        expect(await readFile(join(destDir, 'three.txt'), 'utf8')).toBe('third');
    });

    it('should have default plugin name @rollup-extras/plugin-copy', () => {
        const plugin = copy({ src: 'x' });
        expect(plugin.name).toBe('@rollup-extras/plugin-copy');
    });

    // ===== NEW TESTS FOR COVERAGE =====

    it('should support outputPlugin mode (generateBundle hook)', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'out');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'file.txt'), 'output-plugin-content');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, '*.txt'), outputPlugin: true })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('file.txt');
        expect(await readFile(join(outDir, 'file.txt'), 'utf8')).toBe('output-plugin-content');
    });

    it('should ignore watch option and still copy when outputPlugin is true and watch is true', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'out');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'file.txt'), 'watch-output');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, '*.txt'), outputPlugin: true, watch: true })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('file.txt');
        expect(await readFile(join(outDir, 'file.txt'), 'utf8')).toBe('watch-output');
    });

    it('should ignore watch option and still copy when emitFiles is false', async () => {
        const srcDir = join(tmpDir, 'src');
        const destDir = join(tmpDir, 'dest');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'file.txt'), 'no-emit-watch');

        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 1' }),
                copy({ src: join(srcDir, '*.txt'), dest: destDir, emitFiles: false, watch: true }),
            ],
        });
        await bundle.write({ format: 'es', dir: join(tmpDir, 'out') });
        await bundle.close();

        const files = await readdir(destDir);
        expect(files).toContain('file.txt');
        expect(await readFile(join(destDir, 'file.txt'), 'utf8')).toBe('no-emit-watch');
    });

    it('should skip directories matched by glob (isFile false)', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'out');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'real.txt'), 'real-file');
        await mkdir(join(srcDir, 'fake.txt'), { recursive: true });

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, '*.txt') })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('real.txt');
        expect(await readFile(join(outDir, 'real.txt'), 'utf8')).toBe('real-file');
    });

    it('should skip already-copied files with copyOnce on rebuild', async () => {
        const srcDir = join(tmpDir, 'src');
        const destDir = join(tmpDir, 'dest');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'original.txt'), 'original');

        const plugin = copy({
            src: join(srcDir, '*.txt'),
            dest: destDir,
            emitFiles: false,
            copyOnce: true,
        });

        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), plugin],
        });
        await bundle1.write({ format: 'es', dir: join(tmpDir, 'out1') });
        await bundle1.close();

        expect(await readFile(join(destDir, 'original.txt'), 'utf8')).toBe('original');

        await writeFile(join(destDir, 'original.txt'), 'modified-at-dest');
        await writeFile(join(srcDir, 'new.txt'), 'new-content');

        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), plugin],
        });
        await bundle2.write({ format: 'es', dir: join(tmpDir, 'out2') });
        await bundle2.close();

        expect(await readFile(join(destDir, 'original.txt'), 'utf8')).toBe('modified-at-dest');
        expect(await readFile(join(destDir, 'new.txt'), 'utf8')).toBe('new-content');
    });

    it('should copy files and produce output when verbose is list-filenames', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'out');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'a.txt'), 'aaa');
        await writeFile(join(srcDir, 'b.txt'), 'bbb');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, '*.txt'), verbose: 'list-filenames' })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('a.txt');
        expect(files).toContain('b.txt');
    });

    it('should copy files and produce output when verbose is true', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'out');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'a.txt'), 'aaa');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, '*.txt'), verbose: true })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('a.txt');
    });

    it('should set relative originalFileName when emitOriginalFileName is relative', async () => {
        const srcDir = join(tmpDir, 'src');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'file.txt'), 'content');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, 'file.txt'), emitOriginalFileName: 'relative' })],
        });
        const { output } = await bundle.generate({ format: 'es' });
        await bundle.close();

        const asset = output.find(o => o.type === 'asset' && o.fileName === 'file.txt');
        expect(asset).toBeDefined();
        expect(asset.originalFileName).toBe(join(srcDir, 'file.txt'));
    });

    it('should use custom function for emitOriginalFileName', async () => {
        const srcDir = join(tmpDir, 'src');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'file.txt'), 'content');

        let calledWith = null;
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 1' }),
                copy({
                    src: join(srcDir, 'file.txt'),
                    emitOriginalFileName: filePath => {
                        calledWith = filePath;
                        return `custom-${filePath}`;
                    },
                }),
            ],
        });
        const { output } = await bundle.generate({ format: 'es' });
        await bundle.close();

        expect(calledWith).toBe(join(srcDir, 'file.txt'));
        const asset = output.find(o => o.type === 'asset' && o.fileName === 'file.txt');
        expect(asset).toBeDefined();
        expect(asset.originalFileName).toBe(`custom-${join(srcDir, 'file.txt')}`);
    });

    it('should not set originalFileName when emitOriginalFileName is falsy', async () => {
        const srcDir = join(tmpDir, 'src');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'file.txt'), 'content');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, 'file.txt'), emitOriginalFileName: false })],
        });
        const { output } = await bundle.generate({ format: 'es' });
        await bundle.close();

        const asset = output.find(o => o.type === 'asset' && o.fileName === 'file.txt');
        expect(asset).toBeDefined();
        expect(asset.originalFileName == null).toBe(true);
    });

    it('should normalize trailing slash in dest when flatten is true', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'out');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'file.txt'), 'slash-content');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, '*.txt'), dest: 'assets/', flatten: true })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(join(outDir, 'assets'));
        expect(files).toContain('file.txt');
        expect(await readFile(join(outDir, 'assets', 'file.txt'), 'utf8')).toBe('slash-content');
    });

    it('should handle broken symlinks gracefully (stat error / ENOENT)', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'out');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'good.txt'), 'good-content');
        // Create a symlink pointing to a nonexistent file
        const { symlink } = await import('node:fs/promises');
        await symlink(join(srcDir, 'nonexistent-target'), join(srcDir, 'broken.txt'));

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), copy({ src: join(srcDir, '*.txt') })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('good.txt');
        expect(await readFile(join(outDir, 'good.txt'), 'utf8')).toBe('good-content');
    });

    it('should not throw when file copy encounters a filesystem error', async () => {
        const srcDir = join(tmpDir, 'src');
        const destDir = join(tmpDir, 'dest');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'file.txt'), 'content');
        // Create dest as a file, not a directory - mkdir will succeed but copyFile to dest/file.txt will fail
        // because dest/file.txt parent is actually a file
        await writeFile(join(destDir), 'blocking-file');

        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 1' }),
                copy({ src: join(srcDir, 'file.txt'), dest: join(destDir, 'sub'), emitFiles: false }),
            ],
        });
        // Should not throw - error is caught and logged
        await bundle.write({ format: 'es', dir: join(tmpDir, 'out') });
        await bundle.close();
    });

    it('should filter out invalid target items in targets normalization', async () => {
        const srcDir = join(tmpDir, 'src');
        const outDir = join(tmpDir, 'out');
        await mkdir(srcDir, { recursive: true });
        await writeFile(join(srcDir, 'file.txt'), 'content');

        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 1' }),
                // Pass targets with an invalid item (number) mixed with valid ones
                copy({ targets: [{ src: join(srcDir, '*.txt') }, null, 42] }),
            ],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('file.txt');
    });
});
