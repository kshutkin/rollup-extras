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

    it('should remove old files from output directory on build', async () => {
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

    it('should delete all specified custom target directories', async () => {
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

    it('should not re-delete on second build when deleteOnce is true (default)', async () => {
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

    it('should clean during buildStart before bundle.write when outputPlugin is false', async () => {
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

    it('should clean both output directories when writing to multiple outputs', async () => {
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

    it('should clean the directory when a string is passed as the option', async () => {
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

    it('should clean all directories when an array is passed as the option', async () => {
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

    it('should not throw when a target directory does not exist', async () => {
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

    it('should delete on every build when deleteOnce is false', async () => {
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

    it('should not throw when output uses file instead of dir with outputPlugin true', async () => {
        const outFile = join(tmpDir, 'out.js');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ outputPlugin: true })],
        });
        await expect(bundle.write({ format: 'es', file: outFile })).resolves.not.toThrow();
        await bundle.close();
    });

    it('should normalize and clean a target path with a trailing slash', async () => {
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

    it('should have default plugin name @rollup-extras/plugin-clean', () => {
        expect(clean().name).toBe('@rollup-extras/plugin-clean');
    });

    it('should use custom pluginName as the plugin name', () => {
        expect(clean({ pluginName: 'my-cleaner' }).name).toBe('my-cleaner');
    });

    // ========================================================================
    // NEW TESTS for coverage gaps
    // ========================================================================

    it('should clean both output dirs when using addInstance with outputPlugin true', async () => {
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

    it('should clean via buildStart when using addInstance with outputPlugin false', async () => {
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

    it('should extract and clean targets from a single config.output object', async () => {
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

    it('should extract and clean targets from a config.output array', async () => {
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

    it('should skip buildStart cleanup on second build when deleteOnce is true and outputPlugin is false', async () => {
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

    it('should handle duplicate targets gracefully with outputPlugin true', async () => {
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

    it('should handle duplicate targets gracefully with outputPlugin false', async () => {
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

    it('should skip child deletion when parent is listed first in targets', async () => {
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

    it('should delete both when child is listed before parent in targets', async () => {
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

    it('should not throw when verbose is true', async () => {
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

    it('should handle non-ENOENT filesystem errors without crashing the build', async () => {
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

    it('should be a no-op on buildStart when outputPlugin is false and no targets are configured', async () => {
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

    it('should handle invalid options gracefully without throwing', async () => {
        const outDir = join(tmpDir, 'out');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean(123)],
        });
        await expect(bundle.write({ format: 'es', dir: outDir })).resolves.not.toThrow();
        await bundle.close();
    });

    it('should only delete once across multiple addInstance calls when deleteOnce is true (default)', async () => {
        const targetDir = join(tmpDir, 'target');
        const outDir = join(tmpDir, 'out');
        await mkdir(targetDir, { recursive: true });
        await writeFile(join(targetDir, 'old.txt'), 'old');

        const plugin = clean({ targets: [targetDir] });
        const instance2 = plugin.api.addInstance();

        const v = virtual({ entry: 'export default 1' });

        const bundle1 = await rollup({ input: 'entry', plugins: [v, plugin] });
        await bundle1.write({ format: 'es', dir: outDir });
        await bundle1.close();

        expect(await exists(targetDir)).toBe(false);

        // Recreate the target with a marker
        await mkdir(targetDir, { recursive: true });
        await writeFile(join(targetDir, 'marker.txt'), 'marker');

        const bundle2 = await rollup({ input: 'entry', plugins: [v, instance2] });
        await bundle2.write({ format: 'es', dir: outDir });
        await bundle2.close();

        // deleteOnce: true means the second instance should NOT delete
        expect(await exists(join(targetDir, 'marker.txt'))).toBe(true);
    });

    it('should extract no targets from config.output when entries use file instead of dir', async () => {
        const outFile = join(tmpDir, 'bundle.js');
        const markerDir = join(tmpDir, 'should-survive');
        await mkdir(markerDir, { recursive: true });
        await writeFile(join(markerDir, 'marker.txt'), 'marker');

        const p = clean({ outputPlugin: false });
        const bundle = await rollup({
            input: 'entry',
            output: { file: outFile },
            plugins: [virtual({ entry: 'export default 1' }), p],
        });
        await bundle.write({ format: 'es', file: outFile });
        await bundle.close();

        // No dir was specified, so nothing should be cleaned
        expect(await exists(join(markerDir, 'marker.txt'))).toBe(true);
    });

    it('should accept targets as a single string in the options object', async () => {
        const targetDir = join(tmpDir, 'target');
        const outDir = join(tmpDir, 'out');
        await mkdir(targetDir, { recursive: true });
        await writeFile(join(targetDir, 'old.txt'), 'old');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), clean({ targets: targetDir })],
        });
        await bundle.write({ format: 'es', dir: outDir });
        await bundle.close();

        expect(await exists(targetDir)).toBe(false);
    });
});
