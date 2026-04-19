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

    it('should create a .stats.json file on disk after generating a bundle', async () => {
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

    it('should write entry raw byte size to the stats file', async () => {
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

    it('should include a non-zero gzip field for entries when using default options', async () => {
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

    it('should include a non-zero brotli field for entries when brotli is enabled', async () => {
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

    it('should skip writing the stats file when updateStats is set to false', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath, updateStats: false })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        await expect(access(statsPath, constants.F_OK)).rejects.toThrow();
    });

    it('should group emitted asset sizes under assets keyed by file extension', async () => {
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

    it('should record entry chunks under entries and dynamic chunks under chunks', async () => {
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

    it('should track multiple asset extensions independently in the stats file', async () => {
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

    it('should include non-zero brotli sizes for assets when brotli is enabled', async () => {
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

    it('should omit the gzip field from entries when gzip is disabled', async () => {
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

    it('should omit the brotli field from entries when brotli is not explicitly enabled', async () => {
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

    it('should record both gzip and brotli sizes when both compression options are enabled', async () => {
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

    it('should use cjs as the format key in entries when output format is CommonJS', async () => {
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

    it('should record a minified size that is less than or equal to raw when a minify function is provided', async () => {
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

    it('should record only raw size when both gzip and brotli are disabled', async () => {
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

    it('should accumulate entries from multiple generate calls into a single stats file', async () => {
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

    it('should use @rollup-extras/plugin-size as the default plugin name', () => {
        const plugin = size();
        expect(plugin.name).toBe('@rollup-extras/plugin-size');
    });

    it('should use the provided pluginName as the plugin name property', () => {
        const plugin = size({ pluginName: 'my-size' });
        expect(plugin.name).toBe('my-size');
    });

    it('should complete a second build with delta comparison without errors', async () => {
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

    it('should write .stats.json to the current working directory when no statsFile is specified', async () => {
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

    it('should write human-readable JSON with 2-space indentation and a trailing newline', async () => {
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

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'plugin-size-cov-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should record a larger raw size in the stats file when the second build has more code', async () => {
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

    it('should record a smaller raw size in the stats file when the second build has less code', async () => {
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

    it('should drop previously-tracked format keys from stats when they are absent in the current build', async () => {
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

    it('should correctly measure raw size of assets emitted as Uint8Array buffers', async () => {
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

    it('should use the full filename as the assets key when the file has no extension', async () => {
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

    it('should omit gzip and brotli from both entries and assets when both are disabled', async () => {
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

    it('should record a minified size smaller than raw when the minify function removes whitespace and renames identifiers', async () => {
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

    it('should generate valid stats without errors when verbose mode is enabled', async () => {
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

    it('should sum sizes of all non-entry dynamic chunks under a single chunks format key', async () => {
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

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'plugin-size-final-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should record a raw size greater than 1024 for bundles exceeding 1 kB', async () => {
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

    it('should drop previously-tracked chunk and asset keys that are absent in the current build', async () => {
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

    it('should produce identical raw and gzip values when building the same code twice', async () => {
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

    it('should record increasing raw and brotli sizes across two kB-range builds', async () => {
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

    it('should record decreasing raw size when the second kB-range build is smaller with brotli enabled', async () => {
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

// --- TESTS FOR UNCOVERED LINES 48 AND 109 ---

describe('@rollup-extras/plugin-size (lines 48 & 109 coverage)', () => {
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'plugin-size-lines-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should record a raw size of at least 1 MB for megabyte-scale bundles', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        // Generate a string constant > 1 MB so the chunk raw size hits the MB branch
        const hugeExport = `export default "${'X'.repeat(1_100_000)}";`;
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: hugeExport }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        // The raw size must be >= 1 MB to exercise the MB branch in formatSize
        expect(stats.entries.es.raw).toBeGreaterThanOrEqual(1024 * 1024);
    });

    it('should write an empty stats object when all bundle items are removed before the size plugin runs', async () => {
        const statsPath = join(tmpDir, '.stats.json');

        // Plugin that removes every item from the bundle before the size plugin sees it
        const emptyBundlePlugin = {
            name: 'empty-bundle',
            generateBundle(_options, bundle) {
                for (const key of Object.keys(bundle)) {
                    delete bundle[key];
                }
            },
        };

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 1;' }), emptyBundlePlugin, size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        // With an empty bundle the stats object should have no entries, chunks, or assets
        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats).toEqual({});
    });
});

// --- MISSING TESTS PLAN ---

describe('@rollup-extras/plugin-size (missing tests plan)', () => {
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'size-plan-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('should handle corrupted JSON in a previous stats file gracefully', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        // Write corrupted JSON
        await writeFile(statsPath, '{ invalid json !!!');

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es).toBeDefined();
        expect(stats.entries.es.raw).toBeGreaterThan(0);
    });

    it('should handle a non-existent stats file on the first build without error', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        // No pre-existing stats file — first build creates it from scratch

        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default 42' }), size({ statsFile: statsPath })],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats.entries.es).toBeDefined();
        expect(stats.entries.es.raw).toBeGreaterThan(0);
    });

    it('should not apply minify function to assets (only to chunks)', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const minifyCalls = [];
        const bundle = await rollup({
            input: 'entry',
            plugins: [
                virtual({ entry: 'export default 42' }),
                {
                    name: 'emit-asset',
                    generateBundle() {
                        this.emitFile({
                            type: 'asset',
                            fileName: 'data.json',
                            source: '{"key": "value", "extra": "spacing"}',
                        });
                    },
                },
                size({
                    statsFile: statsPath,
                    minify: async code => {
                        minifyCalls.push(code);
                        return code.replace(/\s+/g, ' ').trim();
                    },
                }),
            ],
        });
        await bundle.generate({ format: 'es', dir: 'dist' });
        await bundle.close();

        const stats = JSON.parse(await readFile(statsPath, 'utf8'));
        // The entry chunk should have a minified size
        expect(stats.entries.es.minified).toBeDefined();
        // The asset should NOT have a minified size
        expect(stats.assets['.json']).toBeDefined();
        expect(stats.assets['.json'].minified).toBeUndefined();
    });

    it('should not carry over stats from a previous build (watch mode)', async () => {
        const statsPath = join(tmpDir, '.stats.json');
        const plugin = size({ statsFile: statsPath });

        // First build: entry with one chunk
        const bundle1 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default "first build";' }), plugin],
        });
        await bundle1.generate({ format: 'es', dir: 'dist' });
        await bundle1.close();

        const stats1 = JSON.parse(await readFile(statsPath, 'utf8'));
        expect(stats1.entries.es).toBeDefined();

        // Second build: entry with different code
        const bundle2 = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'export default "second build with more content for different size";' }), plugin],
        });
        await bundle2.generate({ format: 'es', dir: 'dist' });
        await bundle2.close();

        const stats2 = JSON.parse(await readFile(statsPath, 'utf8'));
        // Stats should reflect only the second build, not accumulate
        expect(stats2.entries.es.raw).not.toBe(stats1.entries.es.raw + stats2.entries.es.raw);
        expect(stats2.entries.es.raw).toBeGreaterThan(stats1.entries.es.raw);
    });
});
