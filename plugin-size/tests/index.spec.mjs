import { constants } from 'node:fs';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollup } from 'rollup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import size from '../src/index.js';

/**
 * Virtual input plugin that resolves and loads modules from an in-memory map.
 * @param {Record<string, string>} modules
 */
function virtual(modules) {
    return {
        name: 'virtual-input',
        resolveId(id) {
            if (modules[id] != null) return id;
        },
        load(id) {
            if (modules[id] != null) return modules[id];
        },
    };
}

/**
 * Helper plugin that emits an asset during the build.
 * @param {string} fileName
 * @param {string} source
 */
function emitAsset(fileName, source) {
    return {
        name: 'emit-asset',
        generateBundle() {
            this.emitFile({ type: 'asset', fileName, source });
        },
    };
}

describe('@rollup-extras/plugin-size integration', () => {
    /** @type {string} */
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'plugin-size-test-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should create a stats file after build', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        // Stats file should exist
        await expect(access(statsPath, constants.F_OK)).resolves.toBeUndefined();
    });

    it('should write stats file containing entry sizes with raw field', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries).toBeDefined();
        expect(stats.entries.es).toBeDefined();
        expect(stats.entries.es.raw).toBeGreaterThan(0);
    });

    it('should include gzip field by default (gzip: true)', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es.gzip).toBeDefined();
        expect(stats.entries.es.gzip).toBeGreaterThan(0);
    });

    it('should include brotli field when brotli: true', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath, brotli: true })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es.brotli).toBeDefined();
        expect(stats.entries.es.brotli).toBeGreaterThan(0);
    });

    it('should not write stats file when updateStats: false', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath, updateStats: false })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        await expect(access(statsPath, constants.F_OK)).rejects.toThrow();
    });

    it('should group emitted assets under the assets key by extension', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 42' }),
                emitAsset('styles.css', 'body { margin: 0; padding: 0; color: red; }'),
                size({ statsFile: statsPath }),
            ],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.assets).toBeDefined();
        expect(stats.assets['.css']).toBeDefined();
        expect(stats.assets['.css'].raw).toBeGreaterThan(0);
        // gzip is enabled by default so it should be present on assets too
        expect(stats.assets['.css'].gzip).toBeGreaterThan(0);
    });

    it('should separate entries and non-entry chunks', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({
                    entry: 'export default () => import("chunk")',
                    chunk: 'export const value = 123',
                }),
                size({ statsFile: statsPath }),
            ],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries).toBeDefined();
        expect(stats.entries.es).toBeDefined();
        expect(stats.entries.es.raw).toBeGreaterThan(0);
        expect(stats.chunks).toBeDefined();
        expect(stats.chunks.es).toBeDefined();
        expect(stats.chunks.es.raw).toBeGreaterThan(0);
    });

    it('should handle multiple asset types', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 42' }),
                emitAsset('styles.css', 'body { margin: 0; }'),
                emitAsset('icon.svg', '<svg></svg>'),
                size({ statsFile: statsPath }),
            ],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.assets['.css']).toBeDefined();
        expect(stats.assets['.css'].raw).toBeGreaterThan(0);
        expect(stats.assets['.svg']).toBeDefined();
        expect(stats.assets['.svg'].raw).toBeGreaterThan(0);
    });

    it('should include brotli on assets when brotli is enabled', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 42' }),
                emitAsset('styles.css', 'body { margin: 0; padding: 0; }'),
                size({ statsFile: statsPath, brotli: true }),
            ],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.assets['.css'].brotli).toBeDefined();
        expect(stats.assets['.css'].brotli).toBeGreaterThan(0);
    });

    it('should not include gzip field when gzip: false', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath, gzip: false })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es.gzip).toBeUndefined();
    });

    it('should not include brotli field by default', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es.brotli).toBeUndefined();
    });

    it('should support both gzip and brotli simultaneously', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath, gzip: true, brotli: true })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es.gzip).toBeGreaterThan(0);
        expect(stats.entries.es.brotli).toBeGreaterThan(0);
    });

    it('should record correct format key for cjs output', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'cjs', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.cjs).toBeDefined();
        expect(stats.entries.cjs.raw).toBeGreaterThan(0);
    });

    it('should include minified field when minify option is provided', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default function hello() { return 42; }' }),
                size({ statsFile: statsPath, minify: async code => code.replace(/\s+/g, ' ') }),
            ],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es.minified).toBeDefined();
        expect(stats.entries.es.minified).toBeGreaterThan(0);
        expect(stats.entries.es.minified).toBeLessThanOrEqual(stats.entries.es.raw);
    });

    it('should omit both gzip and brotli when both are disabled', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath, gzip: false, brotli: false })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es.raw).toBeGreaterThan(0);
        expect(stats.entries.es.gzip).toBeUndefined();
        expect(stats.entries.es.brotli).toBeUndefined();
    });

    it('should merge multiple output formats into the same stats file', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.generate({ format: 'cjs', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es).toBeDefined();
        expect(stats.entries.es.raw).toBeGreaterThan(0);
        expect(stats.entries.cjs).toBeDefined();
        expect(stats.entries.cjs.raw).toBeGreaterThan(0);
    });

    it('should have the default plugin name', () => {
        const plugin = size();
        expect(plugin.name).toBe('@rollup-extras/plugin-size');
    });

    it('should use a custom pluginName', () => {
        const plugin = size({ pluginName: 'my-size' });
        expect(plugin.name).toBe('my-size');
    });

    it('should handle a second build (delta reporting) without crashing', async () => {
        const statsPath = join(tmpDir, '.stats.json');

        // First build
        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle1.generate({ format: 'es', dir: 'dist' });
        await bundle1.close();

        const firstStats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(firstStats.entries.es).toBeDefined();

        // Second build with same statsFile (triggers delta comparison)
        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle2.generate({ format: 'es', dir: 'dist' });
        await bundle2.close();

        const secondStats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(secondStats.entries.es).toBeDefined();
        expect(secondStats.entries.es.raw).toBeGreaterThan(0);
    });

    it('should work with default options (no arguments) using temp dir as cwd', async () => {
        const originalCwd = process.cwd();
        process.chdir(tmpDir);
        try {
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'export default 42' }), size()],
            });
            await bundle.generate({ format: 'es', dir: 'dist' });
            await bundle.close();

            // Default stats file should be created at .stats.json in cwd (tmpDir)
            const statsPath = join(tmpDir, '.stats.json');
            await expect(access(statsPath, constants.F_OK)).resolves.toBeUndefined();
            const stats = JSON.parse(await readFile(statsPath, 'utf8'));
            expect(stats.entries.es).toBeDefined();
        } finally {
            process.chdir(originalCwd);
        }
    });

    it('should produce a properly formatted stats JSON file', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const raw = await readFile(statsPath, 'utf8');
        // Should end with a newline
        expect(raw.endsWith('\n')).toBe(true);
        // Should be properly indented (2-space indent from JSON.stringify(_, null, 2))
        expect(raw).toContain('  "entries"');
        // Should be valid JSON
        const parsed = JSON.parse(raw);
        expect(parsed).toBeDefined();
        expect(parsed.entries).toBeDefined();
    });
});

// --- NEW TESTS FOR BRANCH COVERAGE ---

describe('@rollup-extras/plugin-size (additional coverage)', () => {
    let tmpDir;

    function virtual(modules) {
        return {
            name: 'virtual-input',
            resolveId(id) {
                if (modules[id] != null) return id;
            },
            load(id) {
                if (modules[id] != null) return modules[id];
            },
        };
    }

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'plugin-size-cov-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should report delta increase when second build is larger', async () => {
        const statsPath = join(tmpDir, '.stats.json');

        // First build: small code
        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), size({ statsFile: statsPath })],
        });
        await bundle1.generate({ format: 'es', dir: 'dist' });
        await bundle1.close();

        const firstStats = JSON.parse(await readFile(statsPath, 'utf8'));
        const firstRaw = firstStats.entries.es.raw;

        // Second build: larger code
        const bundle2 = await rollup({
            input: 'entry',
            plugins: [
                virtual({
                    entry: 'export default function aVeryLongFunctionNameForTesting() { return "a long string to increase bundle size significantly over the first build output size"; }',
                }),
                size({ statsFile: statsPath }),
            ],
        });
        await bundle2.generate({ format: 'es', dir: 'dist' });
        await bundle2.close();

        const secondStats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(secondStats.entries.es.raw).toBeGreaterThan(firstRaw);
    });

    it('should report delta decrease when second build is smaller', async () => {
        const statsPath = join(tmpDir, '.stats.json');

        // First build: larger code
        const bundle1 = await rollup({
            input: 'entry',
            plugins: [
                virtual({
                    entry: 'export default function aVeryLongFunctionNameForTesting() { return "a long string to increase the initial bundle size significantly"; }',
                }),
                size({ statsFile: statsPath }),
            ],
        });
        await bundle1.generate({ format: 'es', dir: 'dist' });
        await bundle1.close();

        const firstStats = JSON.parse(await readFile(statsPath, 'utf8'));
        const firstRaw = firstStats.entries.es.raw;

        // Second build: smaller code
        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1' }), size({ statsFile: statsPath })],
        });
        await bundle2.generate({ format: 'es', dir: 'dist' });
        await bundle2.close();

        const secondStats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(secondStats.entries.es.raw).toBeLessThan(firstRaw);
    });

    it('should handle a removed entry format in stats comparison', async () => {
        const statsPath = join(tmpDir, '.stats.json');

        // Pre-seed stats file with an entry format that will not exist in current build
        await writeFile(
            statsPath,
            JSON.stringify({
                entries: { cjs: { raw: 100, gzip: 50 } },
                chunks: {},
                assets: {},
            })
        );

        // Build only es format
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es).toBeDefined();
        expect(stats.entries.es.raw).toBeGreaterThan(0);
        // cjs was in previous stats but not in current build, triggers 'removed' path
        expect(stats.entries.cjs).toBeUndefined();
    });

    it('should handle assets with Uint8Array source', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 42' }),
                {
                    name: 'emit-binary-asset',
                    generateBundle() {
                        this.emitFile({
                            type: 'asset',
                            fileName: 'data.bin',
                            source: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]),
                        });
                    },
                },
                size({ statsFile: statsPath }),
            ],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.assets['.bin']).toBeDefined();
        expect(stats.assets['.bin'].raw).toBe(5);
    });

    it('should handle assets without file extension (fallback to filename)', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 42' }),
                {
                    name: 'emit-extensionless-asset',
                    generateBundle() {
                        this.emitFile({
                            type: 'asset',
                            fileName: 'LICENSE',
                            source: 'MIT License',
                        });
                    },
                },
                size({ statsFile: statsPath }),
            ],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        // extname('LICENSE') returns '' so fallback uses full filename
        expect(stats.assets.LICENSE).toBeDefined();
        expect(stats.assets.LICENSE.raw).toBeGreaterThan(0);
    });

    it('should produce stats with neither gzip nor brotli when both disabled', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 42' }),
                {
                    name: 'emit-asset-for-no-compress',
                    generateBundle() {
                        this.emitFile({
                            type: 'asset',
                            fileName: 'styles.css',
                            source: 'body { margin: 0; }',
                        });
                    },
                },
                size({ statsFile: statsPath, gzip: false, brotli: false }),
            ],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es.gzip).toBeUndefined();
        expect(stats.entries.es.brotli).toBeUndefined();
        expect(stats.assets['.css'].gzip).toBeUndefined();
        expect(stats.assets['.css'].brotli).toBeUndefined();
    });

    it('should report different minified size with a real minify function', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({
                    entry: `
                        export default function reallyLongFunctionName() {
                            const variableWithVeryLongName = 42;
                            return variableWithVeryLongName;
                        }
                    `,
                }),
                size({
                    statsFile: statsPath,
                    minify: async code => {
                        return code
                            .replace(/\s+/g, ' ')
                            .replace(/reallyLongFunctionName/g, 'f')
                            .replace(/variableWithVeryLongName/g, 'v')
                            .trim();
                    },
                }),
            ],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es.minified).toBeDefined();
        expect(stats.entries.es.minified).toBeLessThan(stats.entries.es.raw);
    });

    it('should build successfully with verbose: true option', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath, verbose: true })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es).toBeDefined();
        expect(stats.entries.es.raw).toBeGreaterThan(0);
    });

    it('should accumulate sizes from multiple non-entry chunks', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({
                    entry: 'export default () => { const p1 = import("chunk1"); const p2 = import("chunk2"); return Promise.all([p1, p2]); }',
                    chunk1: 'export const a = "first dynamic chunk with some substantial content to prevent inlining"; export function helper() { return a; }',
                    chunk2: 'export const b = "second dynamic chunk with some substantial content to prevent inlining"; export function helper2() { return b; }',
                }),
                size({ statsFile: statsPath }),
            ],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es).toBeDefined();
        expect(stats.entries.es.raw).toBeGreaterThan(0);
        expect(stats.chunks).toBeDefined();
        expect(stats.chunks.es).toBeDefined();
        expect(stats.chunks.es.raw).toBeGreaterThan(0);
    });
});

// --- ADDITIONAL TESTS FOR REMAINING BRANCH COVERAGE ---

describe('@rollup-extras/plugin-size (final branch coverage)', () => {
    let tmpDir;

    function virtual(modules) {
        return {
            name: 'virtual-input',
            resolveId(id) {
                if (modules[id] != null) return id;
            },
            load(id) {
                if (modules[id] != null) return modules[id];
            },
        };
    }

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'plugin-size-final-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should format sizes in kB range when output exceeds 1024 bytes', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        // Generate code large enough to exceed 1024 bytes raw
        const longExport = `export const data = ${JSON.stringify('x'.repeat(1200))};`;
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: longExport }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es.raw).toBeGreaterThan(1024);
    });

    it('should report removed chunks and removed assets from previous stats', async () => {
        const statsPath = join(tmpDir, '.stats.json');

        // Pre-seed stats with entries, chunks, AND assets that won't be in current build
        await writeFile(
            statsPath,
            JSON.stringify({
                entries: { iife: { raw: 500, gzip: 250 } },
                chunks: { iife: { raw: 600, gzip: 300 } },
                assets: { '.woff': { raw: 700, gzip: 350 } },
            })
        );

        // Build produces only es entries - iife entries/chunks and .woff assets are "removed"
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es).toBeDefined();
        // The old iife entry/chunk and .woff asset are not in current stats
        expect(stats.entries.iife).toBeUndefined();
        expect(stats.chunks).toBeUndefined();
        expect(stats.assets).toBeUndefined();
    });

    it('should handle delta = 0 for gzip when code is identical across two builds', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const code = 'export default 42';

        // First build
        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: code }), size({ statsFile: statsPath })],
        });
        await bundle1.generate({ format: 'es', dir: 'dist' });
        await bundle1.close();

        const firstStats = JSON.parse(await readFile(statsPath, 'utf8'));

        // Second build with identical code - delta should be 0
        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: code }), size({ statsFile: statsPath })],
        });
        await bundle2.generate({ format: 'es', dir: 'dist' });
        await bundle2.close();

        const secondStats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(secondStats.entries.es.raw).toBe(firstStats.entries.es.raw);
        expect(secondStats.entries.es.gzip).toBe(firstStats.entries.es.gzip);
    });

    it('should exercise delta reporting on kB-sized bundles with brotli', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const smallCode = `export const data = ${JSON.stringify('a'.repeat(1200))};`;
        const largeCode = `export const data = ${JSON.stringify('b'.repeat(2400))}; export const extra = ${JSON.stringify('c'.repeat(1200))};`;

        // First build: small kB-range code
        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: smallCode }), size({ statsFile: statsPath, brotli: true })],
        });
        await bundle1.generate({ format: 'es', dir: 'dist' });
        await bundle1.close();

        const firstStats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(firstStats.entries.es.raw).toBeGreaterThan(1024);
        expect(firstStats.entries.es.brotli).toBeGreaterThan(0);

        // Second build: larger kB-range code - delta > 0 in kB range
        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: largeCode }), size({ statsFile: statsPath, brotli: true })],
        });
        await bundle2.generate({ format: 'es', dir: 'dist' });
        await bundle2.close();

        const secondStats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(secondStats.entries.es.raw).toBeGreaterThan(firstStats.entries.es.raw);
        expect(secondStats.entries.es.brotli).toBeGreaterThan(0);
    });

    it('should handle delta decrease on kB-range bundles with brotli', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const largeCode = `export const data = ${JSON.stringify('a'.repeat(2400))}; export const extra = ${JSON.stringify('b'.repeat(1200))};`;
        const smallCode = `export const data = ${JSON.stringify('c'.repeat(1200))};`;

        // First build: large kB-range code
        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: largeCode }), size({ statsFile: statsPath, brotli: true })],
        });
        await bundle1.generate({ format: 'es', dir: 'dist' });
        await bundle1.close();

        const firstStats = JSON.parse(await readFile(statsPath, 'utf8'));

        // Second build: smaller kB-range code - delta < 0 in kB range
        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: smallCode }), size({ statsFile: statsPath, brotli: true })],
        });
        await bundle2.generate({ format: 'es', dir: 'dist' });
        await bundle2.close();

        const secondStats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(secondStats.entries.es.raw).toBeLessThan(firstStats.entries.es.raw);
    });
});
