import { access, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollup } from 'rollup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import clean from '../src/index.js';

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

async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

describe('@rollup-extras/plugin-clean integration', () => {
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'clean-test-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('basic cleaning: old files are removed from output dir', async () => {
        const outputDir = join(tmpDir, 'dist');
        await mkdir(outputDir, { recursive: true });
        await writeFile(join(outputDir, 'old-file.txt'), 'old content');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean()],
        });
        await bundle.write({ format: 'es', dir: outputDir });
        await bundle.close();

        const files = await readdir(outputDir);
        expect(files).not.toContain('old-file.txt');
        expect(files).toContain('entry.js');
    });

    it('custom targets: specified directories are deleted', async () => {
        const target1 = join(tmpDir, 'target1');
        const target2 = join(tmpDir, 'target2');
        const outputDir = join(tmpDir, 'out');

        await mkdir(target1, { recursive: true });
        await mkdir(target2, { recursive: true });
        await writeFile(join(target1, 'file1.txt'), 'data1');
        await writeFile(join(target2, 'file2.txt'), 'data2');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ targets: [target1, target2] })],
        });
        await bundle.write({ format: 'es', dir: outputDir });
        await bundle.close();

        expect(await exists(target1)).toBe(false);
        expect(await exists(target2)).toBe(false);
        // output dir should have been created by rollup
        const files = await readdir(outputDir);
        expect(files).toContain('entry.js');
    });

    it('deleteOnce true (default): second build does not re-delete', async () => {
        const outputDir = join(tmpDir, 'dist');
        const v = virtual({ entry: 'export default 1' });
        const p = clean();

        // First build: create old file, build removes it
        await mkdir(outputDir, { recursive: true });
        await writeFile(join(outputDir, 'old-file.txt'), 'old');

        const bundle1 = await rollup({ input: 'entry', plugins: [v, p] });
        await bundle1.write({ format: 'es', dir: outputDir });
        await bundle1.close();

        let files = await readdir(outputDir);
        expect(files).not.toContain('old-file.txt');
        expect(files).toContain('entry.js');

        // Place a marker file after first build
        await writeFile(join(outputDir, 'marker.txt'), 'marker');

        // Second build with same plugin instance: deleteOnce prevents re-cleaning
        const bundle2 = await rollup({ input: 'entry', plugins: [v, p] });
        await bundle2.write({ format: 'es', dir: outputDir });
        await bundle2.close();

        files = await readdir(outputDir);
        // marker.txt should survive because the plugin did not clean on second build
        expect(files).toContain('marker.txt');
        expect(files).toContain('entry.js');
    });

    it('outputPlugin false: cleaning happens during buildStart before write', async () => {
        const outputDir = join(tmpDir, 'dist');
        await mkdir(outputDir, { recursive: true });
        await writeFile(join(outputDir, 'old-file.txt'), 'old content');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ outputPlugin: false, targets: [outputDir] })],
        });

        // After rollup() but before write: dir should already be cleaned
        expect(await exists(join(outputDir, 'old-file.txt'))).toBe(false);

        await bundle.write({ format: 'es', dir: outputDir });
        await bundle.close();

        const files = await readdir(outputDir);
        expect(files).toContain('entry.js');
        expect(files).not.toContain('old-file.txt');
    });

    it('multiple output dirs: both get cleaned', async () => {
        const outputDir1 = join(tmpDir, 'dist1');
        const outputDir2 = join(tmpDir, 'dist2');

        await mkdir(outputDir1, { recursive: true });
        await mkdir(outputDir2, { recursive: true });
        await writeFile(join(outputDir1, 'old1.txt'), 'old1');
        await writeFile(join(outputDir2, 'old2.txt'), 'old2');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ deleteOnce: false })],
        });

        await bundle.write({ format: 'es', dir: outputDir1 });
        await bundle.write({ format: 'es', dir: outputDir2 });
        await bundle.close();

        const files1 = await readdir(outputDir1);
        expect(files1).not.toContain('old1.txt');
        expect(files1).toContain('entry.js');

        const files2 = await readdir(outputDir2);
        expect(files2).not.toContain('old2.txt');
        expect(files2).toContain('entry.js');
    });

    it('string shorthand option: clean(dir) cleans the directory', async () => {
        const outputDir = join(tmpDir, 'dist');
        await mkdir(outputDir, { recursive: true });
        await writeFile(join(outputDir, 'old-file.txt'), 'old content');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean(outputDir)],
        });
        await bundle.write({ format: 'es', dir: outputDir });
        await bundle.close();

        const files = await readdir(outputDir);
        expect(files).not.toContain('old-file.txt');
        expect(files).toContain('entry.js');
    });

    it('array shorthand option: clean([dir1, dir2]) cleans both directories', async () => {
        const target1 = join(tmpDir, 'dir1');
        const target2 = join(tmpDir, 'dir2');
        const outputDir = join(tmpDir, 'out');

        await mkdir(target1, { recursive: true });
        await mkdir(target2, { recursive: true });
        await writeFile(join(target1, 'file1.txt'), 'data1');
        await writeFile(join(target2, 'file2.txt'), 'data2');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean([target1, target2])],
        });
        await bundle.write({ format: 'es', dir: outputDir });
        await bundle.close();

        expect(await exists(target1)).toBe(false);
        expect(await exists(target2)).toBe(false);
    });

    it('ENOENT handling: non-existent target does not crash the build', async () => {
        const nonExistent = join(tmpDir, 'does-not-exist');
        const outputDir = join(tmpDir, 'out');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ targets: [nonExistent] })],
        });
        await expect(bundle.write({ format: 'es', dir: outputDir })).resolves.not.toThrow();
        await bundle.close();

        const files = await readdir(outputDir);
        expect(files).toContain('entry.js');
    });

    it('deleteOnce false with repeated builds: marker files are deleted each time', async () => {
        const outputDir = join(tmpDir, 'dist');
        const v = virtual({ entry: 'export default 1' });
        const p = clean({ deleteOnce: false });

        // First build
        await mkdir(outputDir, { recursive: true });
        await writeFile(join(outputDir, 'old-file.txt'), 'old');

        const bundle1 = await rollup({ input: 'entry', plugins: [v, p] });
        await bundle1.write({ format: 'es', dir: outputDir });
        await bundle1.close();

        let files = await readdir(outputDir);
        expect(files).not.toContain('old-file.txt');
        expect(files).toContain('entry.js');

        // Place a marker file after first build
        await writeFile(join(outputDir, 'marker.txt'), 'marker');

        // Second build: deleteOnce is false so it should clean again
        const bundle2 = await rollup({ input: 'entry', plugins: [v, p] });
        await bundle2.write({ format: 'es', dir: outputDir });
        await bundle2.close();

        files = await readdir(outputDir);
        // marker.txt should be gone because the plugin cleans on every build
        expect(files).not.toContain('marker.txt');
        expect(files).toContain('entry.js');
    });

    it('no dir in output (file-based output) with outputPlugin: true does not throw', async () => {
        const outFile = join(tmpDir, 'out.js');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ outputPlugin: true })],
        });
        await expect(bundle.write({ format: 'es', file: outFile })).resolves.not.toThrow();
        await bundle.close();
    });

    it('trailing slash normalization: target with trailing slash is cleaned', async () => {
        const targetDir = join(tmpDir, 'trail');
        await mkdir(targetDir, { recursive: true });
        await writeFile(join(targetDir, 'old.txt'), 'old');

        const targetWithSlash = `${targetDir}/`;
        const outputDir = join(tmpDir, 'out');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ targets: [targetWithSlash] })],
        });
        await bundle.write({ format: 'es', dir: outputDir });
        await bundle.close();

        expect(await exists(targetDir)).toBe(false);
    });

    it('default plugin name is @rollup-extras/plugin-clean', () => {
        expect(clean().name).toBe('@rollup-extras/plugin-clean');
    });

    it('custom pluginName option is reflected in plugin name', () => {
        expect(clean({ pluginName: 'my-cleaner' }).name).toBe('my-cleaner');
    });

    // ========================================================================
    // NEW TESTS for coverage gaps
    // ========================================================================

    it('addInstance() with outputPlugin: true cleans both output dirs', async () => {
        const dir1 = join(tmpDir, 'out1');
        const dir2 = join(tmpDir, 'out2');
        await mkdir(dir1, { recursive: true });
        await mkdir(dir2, { recursive: true });
        await writeFile(join(dir1, 'old1.txt'), 'old1');
        await writeFile(join(dir2, 'old2.txt'), 'old2');

        const plugin = clean({ deleteOnce: false });
        const instance2 = plugin.api.addInstance();

        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), plugin],
        });
        await bundle1.write({ format: 'es', dir: dir1 });
        await bundle1.close();

        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), instance2],
        });
        await bundle2.write({ format: 'es', dir: dir2 });
        await bundle2.close();

        const files1 = await readdir(dir1);
        expect(files1).not.toContain('old1.txt');
        expect(files1).toContain('entry.js');

        const files2 = await readdir(dir2);
        expect(files2).not.toContain('old2.txt');
        expect(files2).toContain('entry.js');
    });

    it('addInstance() with outputPlugin: false cleans via buildStart', async () => {
        const dir1 = join(tmpDir, 'target1');
        const outDir = join(tmpDir, 'out');
        await mkdir(dir1, { recursive: true });
        await writeFile(join(dir1, 'f1.txt'), 'data1');

        const plugin = clean({ outputPlugin: false, deleteOnce: false, targets: [dir1] });
        const instance2 = plugin.api.addInstance();

        // Use both instances in same build (multi-config pattern)
        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), plugin],
        });
        await bundle1.write({ format: 'es', dir: outDir });

        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), instance2],
        });
        await bundle2.write({ format: 'es', dir: outDir });
        await bundle2.close();
        await bundle1.close();

        // dir1 should have been cleaned during buildStart
        expect(await exists(dir1)).toBe(false);
    });

    it('optionsHook extracts targets from single config.output', async () => {
        const outputDir = join(tmpDir, 'inferred');
        await mkdir(outputDir, { recursive: true });
        await writeFile(join(outputDir, 'old.txt'), 'old');

        const p = clean({ outputPlugin: false });
        const bundle = await rollup({
            input: 'entry',
            output: { dir: outputDir },
            plugins: [virtual({ entry: 'export default 1' }), p],
        });

        expect(await exists(join(outputDir, 'old.txt'))).toBe(false);

        await bundle.write({ format: 'es', dir: outputDir });
        await bundle.close();

        const files = await readdir(outputDir);
        expect(files).toContain('entry.js');
    });

    it('optionsHook extracts targets from array config.output', async () => {
        const dir1 = join(tmpDir, 'esm');
        const dir2 = join(tmpDir, 'cjs');
        await mkdir(dir1, { recursive: true });
        await mkdir(dir2, { recursive: true });
        await writeFile(join(dir1, 'old-esm.txt'), 'old');
        await writeFile(join(dir2, 'old-cjs.txt'), 'old');

        const p = clean({ outputPlugin: false });
        const bundle = await rollup({
            input: 'entry',
            output: [
                { format: 'es', dir: dir1 },
                { format: 'cjs', dir: dir2 },
            ],
            plugins: [virtual({ entry: 'export default 1' }), p],
        });

        expect(await exists(join(dir1, 'old-esm.txt'))).toBe(false);
        expect(await exists(join(dir2, 'old-cjs.txt'))).toBe(false);

        await bundle.write({ format: 'es', dir: dir1 });
        await bundle.close();
    });

    it('buildStart early return when deleted (outputPlugin: false, deleteOnce: true)', async () => {
        const targetDir = join(tmpDir, 'target');
        const outDir = join(tmpDir, 'out');
        await mkdir(targetDir, { recursive: true });
        await writeFile(join(targetDir, 'old.txt'), 'old');

        const v = virtual({ entry: 'export default 1' });
        const p = clean({ outputPlugin: false, deleteOnce: true, targets: [targetDir] });

        const bundle1 = await rollup({ input: 'entry', plugins: [v, p] });
        await bundle1.write({ format: 'es', dir: outDir });
        await bundle1.close();

        expect(await exists(targetDir)).toBe(false);

        await mkdir(targetDir, { recursive: true });
        await writeFile(join(targetDir, 'marker.txt'), 'marker');

        const bundle2 = await rollup({ input: 'entry', plugins: [v, p] });
        await bundle2.write({ format: 'es', dir: outDir });
        await bundle2.close();

        expect(await exists(join(targetDir, 'marker.txt'))).toBe(true);
    });

    it('duplicate target: same dir listed twice in targets (outputPlugin: true)', async () => {
        const dir = join(tmpDir, 'dup');
        const outDir = join(tmpDir, 'out');
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'old.txt'), 'old');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ targets: [dir, dir] })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        expect(await exists(dir)).toBe(false);
    });

    it('duplicate target with outputPlugin: false', async () => {
        const dir = join(tmpDir, 'dup');
        const outDir = join(tmpDir, 'out');
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'old.txt'), 'old');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ outputPlugin: false, targets: [dir, dir] })],
        });

        expect(await exists(dir)).toBe(false);

        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();
    });

    it('nested targets: parent then child (child skipped via parentsInProgress)', async () => {
        const parent = join(tmpDir, 'parent');
        const child = join(parent, 'child');
        const outDir = join(tmpDir, 'out');
        await mkdir(child, { recursive: true });
        await writeFile(join(parent, 'p.txt'), 'p');
        await writeFile(join(child, 'c.txt'), 'c');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ targets: [parent, child] })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        expect(await exists(parent)).toBe(false);
    });

    it('nested targets: child then parent (parent waits for child)', async () => {
        const parent = join(tmpDir, 'parent');
        const child = join(parent, 'child');
        const outDir = join(tmpDir, 'out');
        await mkdir(child, { recursive: true });
        await writeFile(join(parent, 'p.txt'), 'p');
        await writeFile(join(child, 'c.txt'), 'c');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ targets: [child, parent] })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        expect(await exists(parent)).toBe(false);
    });

    it('verbose: true logs at info level without error', async () => {
        const dir = join(tmpDir, 'verbose-target');
        const outDir = join(tmpDir, 'out');
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'old.txt'), 'old');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ verbose: true, targets: [dir] })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        expect(await exists(dir)).toBe(false);
    });

    it('non-ENOENT filesystem error does not crash build', async () => {
        const protectedParent = join(tmpDir, 'protected');
        const targetInside = join(protectedParent, 'inner');
        await mkdir(targetInside, { recursive: true });
        await writeFile(join(targetInside, 'file.txt'), 'data');

        // Make parent read-only so recursive delete of inner fails with EACCES/EPERM
        const { chmod } = await import('node:fs/promises');
        await chmod(protectedParent, 0o555);

        try {
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'export default 1' }), clean({ targets: [targetInside] })],
            });

            // Should not throw despite permission error - logged as warning instead
            const outDir = join(tmpDir, 'out');
            await expect(bundle.write({ format: 'es', dir: outDir })).resolves.not.toThrow();
            await bundle.close();
        } finally {
            // Restore permissions so afterEach cleanup works
            await chmod(protectedParent, 0o755);
        }
    });

    it('outputPlugin false with no targets and no output dir in config: buildStart is a no-op', async () => {
        const outDir = join(tmpDir, 'out');
        const p = clean({ outputPlugin: false });
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), p],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        const files = await readdir(outDir);
        expect(files).toContain('entry.js');
    });
});
