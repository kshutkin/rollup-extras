import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollup } from 'rollup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import binify from '../src/index.js';

vi.mock('node:fs/promises', async importOriginal => {
    const mod = await importOriginal();
    return { ...mod, chmod: vi.fn(mod.chmod) };
});

import { chmod } from 'node:fs/promises';

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

describe('@rollup-extras/plugin-binify integration', () => {
    describe('generate', () => {
        it('should prepend shebang to entry chunk code', async () => {
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("hello")' }), binify()],
            });
            const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
            expect(output[0].code.startsWith('#!/usr/bin/env node\n')).toBe(true);
            await bundle.close();
        });

        it('should support a custom shebang string', async () => {
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("hello")' }), binify({ shebang: '#!/usr/bin/env deno' })],
            });
            const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
            expect(output[0].code.startsWith('#!/usr/bin/env deno\n')).toBe(true);
            await bundle.close();
        });

        it('should not add shebang to non-entry chunks', async () => {
            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    virtual({
                        entry: 'import("./dynamic").then(m => m.default())',
                        './dynamic': 'export default function() { return 42; }',
                    }),
                    binify(),
                ],
            });
            const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
            const entryChunk = output.find(o => o.type === 'chunk' && o.isEntry);
            const nonEntryChunks = output.filter(o => o.type === 'chunk' && !o.isEntry);
            expect(entryChunk.code.startsWith('#!/usr/bin/env node\n')).toBe(true);
            expect(nonEntryChunks.length).toBeGreaterThan(0);
            for (const chunk of nonEntryChunks) {
                expect(chunk.code.startsWith('#!')).toBe(false);
            }
            await bundle.close();
        });

        it('should adjust sourcemap mappings when shebang is added', async () => {
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("hello")' }), binify()],
            });
            const { output } = await bundle.generate({ format: 'es', dir: 'dist', sourcemap: true });
            const entryChunk = output.find(o => o.type === 'chunk' && o.isEntry);
            expect(entryChunk.map).toBeTruthy();
            expect(entryChunk.map.mappings.startsWith(';')).toBe(true);
            await bundle.close();
        });

        it('should use the default plugin name when no pluginName option is provided', () => {
            expect(binify().name).toBe('@rollup-extras/plugin-binify');
        });

        it('should use custom pluginName when provided in options', () => {
            expect(binify({ pluginName: 'custom' }).name).toBe('custom');
        });

        it('should only add shebang to filtered chunks with custom filter', async () => {
            const bundle = await rollup({
                input: {
                    entry: 'entry',
                    other: 'other',
                },
                plugins: [
                    virtual({
                        entry: 'console.log("entry")',
                        other: 'console.log("other")',
                    }),
                    binify({ filter: item => item.type === 'chunk' && item.fileName === 'entry.js' }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
            const entryChunk = output.find(o => o.fileName === 'entry.js');
            const otherChunk = output.find(o => o.fileName === 'other.js');
            expect(entryChunk.code.startsWith('#!/usr/bin/env node\n')).toBe(true);
            expect(otherChunk.code.startsWith('#!')).toBe(false);
            await bundle.close();
        });

        it('should add shebang without generating a sourcemap when sourcemap option is disabled', async () => {
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("hello")' }), binify()],
            });
            const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
            expect(output[0].code.startsWith('#!/usr/bin/env node\n')).toBe(true);
            expect(output[0].map).toBeFalsy();
            await bundle.close();
        });
    });

    describe('write', () => {
        let tmpDir;

        beforeEach(async () => {
            tmpDir = await mkdtemp(join(tmpdir(), 'binify-test-'));
        });

        afterEach(async () => {
            await rm(tmpDir, { recursive: true });
        });

        it('should set executable permissions on written files', async () => {
            if (process.platform === 'win32') {
                return;
            }

            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("hello")' }), binify()],
            });
            await bundle.write({ format: 'es', dir: tmpDir });
            const fileStat = await stat(join(tmpDir, 'entry.js'));
            expect(fileStat.mode & 0o777).toBe(0o755);
            await bundle.close();
        });

        it('should not set executable permissions when executableFlag is false', async () => {
            if (process.platform === 'win32') {
                return;
            }

            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("hello")' }), binify({ executableFlag: false })],
            });
            await bundle.write({ format: 'es', dir: tmpDir });
            const fileStat = await stat(join(tmpDir, 'entry.js'));
            // Should NOT be 0o755 since we disabled executable flag
            expect(fileStat.mode & 0o777).not.toBe(0o755);
            // But the code should still have the shebang
            const { readFile } = await import('node:fs/promises');
            const fileContent = await readFile(join(tmpDir, 'entry.js'), 'utf-8');
            expect(fileContent.startsWith('#!/usr/bin/env node\n')).toBe(true);
            await bundle.close();
        });

        it('should set custom executable flag value', async () => {
            if (process.platform === 'win32') {
                return;
            }

            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("hello")' }), binify({ executableFlag: 0o700 })],
            });
            await bundle.write({ format: 'es', dir: tmpDir });
            const fileStat = await stat(join(tmpDir, 'entry.js'));
            expect(fileStat.mode & 0o777).toBe(0o700);
            await bundle.close();
        });
    });
});

// --- NEW TESTS FOR BRANCH COVERAGE ---

describe('@rollup-extras/plugin-binify (additional coverage)', () => {
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

    describe('generate - asset and filter', () => {
        it('should prepend shebang to emitted asset source when custom filter returns true for all items', async () => {
            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    virtual({ entry: 'console.log("hello")' }),
                    {
                        name: 'emit-asset',
                        generateBundle() {
                            this.emitFile({
                                type: 'asset',
                                fileName: 'run.sh',
                                source: 'echo hello',
                            });
                        },
                    },
                    binify({ filter: () => true }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
            const asset = output.find(o => o.type === 'asset' && o.fileName === 'run.sh');
            expect(asset).toBeDefined();
            expect(String(asset.source).startsWith('#!/usr/bin/env node\n')).toBe(true);
            const chunk = output.find(o => o.type === 'chunk');
            expect(chunk.code.startsWith('#!/usr/bin/env node\n')).toBe(true);
            await bundle.close();
        });
    });

    describe('write - chmod and executableFlag', () => {
        let tmpDir;

        beforeEach(async () => {
            tmpDir = await mkdtemp(join(tmpdir(), 'binify-cov-'));
        });

        afterEach(async () => {
            await rm(tmpDir, { recursive: true, force: true });
        });

        it('should not throw when chmod fails on a nonexistent directory', async () => {
            if (process.platform === 'win32') return;

            const plugin = binify();

            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("hello")' }), plugin],
            });

            // generate() runs renderStart + generateBundle (sets internal state)
            // but does NOT write files to disk
            const result = await bundle.generate({ format: 'es', dir: join(tmpDir, 'nonexistent') });

            // Manually invoke writeBundle: chmod will fail because files do not exist on disk
            const bundleObj = {};
            for (const item of result.output) {
                bundleObj[item.fileName] = item;
            }

            // Should not throw - the error is caught and logged internally
            await plugin.writeBundle.call({}, { dir: join(tmpDir, 'nonexistent') }, bundleObj);

            await bundle.close();
        });

        it('should not call chmod when executableFlag is explicitly false', async () => {
            if (process.platform === 'win32') return;

            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("hello")' }), binify({ executableFlag: false })],
            });
            await bundle.write({ format: 'es', dir: tmpDir });

            // The shebang should still be present
            const { readFile } = await import('node:fs/promises');
            const fileContent = await readFile(join(tmpDir, 'entry.js'), 'utf-8');
            expect(fileContent.startsWith('#!/usr/bin/env node\n')).toBe(true);

            // Permissions should NOT be 0o755 (chmod was never called)
            const fileStat = await stat(join(tmpDir, 'entry.js'));
            expect(fileStat.mode & 0o777).not.toBe(0o755);

            await bundle.close();
        });
    });
});

// --- ADDITIONAL TESTS FOR NEAR-100% BRANCH COVERAGE ---

describe('@rollup-extras/plugin-binify (branch coverage)', () => {
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

    describe('generate - asset with filter: () => true', () => {
        it('should prepend shebang to an emitted asset source (not just chunk code)', async () => {
            const emitAsset = {
                name: 'emit-asset',
                generateBundle() {
                    this.emitFile({ type: 'asset', fileName: 'script.sh', source: 'echo hello' });
                },
            };
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("hi")' }), emitAsset, binify({ filter: () => true })],
            });
            const { output } = await bundle.generate({ format: 'es', dir: 'dist' });

            const asset = output.find(o => o.type === 'asset' && o.fileName === 'script.sh');
            expect(asset).toBeDefined();
            expect(String(asset.source).startsWith('#!/usr/bin/env node\n')).toBe(true);
            expect(String(asset.source)).toContain('echo hello');

            const chunk = output.find(o => o.type === 'chunk');
            expect(chunk.code.startsWith('#!/usr/bin/env node\n')).toBe(true);

            await bundle.close();
        });
    });

    describe('write - chmod failure via spy', () => {
        let tmpDir;

        beforeEach(async () => {
            tmpDir = await mkdtemp(join(tmpdir(), 'binify-spy-'));
        });

        afterEach(async () => {
            vi.mocked(chmod).mockRestore();
            await rm(tmpDir, { recursive: true, force: true });
        });

        it('should not crash when chmod rejects (catch branch)', async () => {
            if (process.platform === 'win32') return;

            vi.mocked(chmod).mockRejectedValueOnce(new Error('EPERM'));

            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("hello")' }), binify()],
            });

            // write() triggers renderStart + generateBundle + writeBundle
            // chmod will fail on the first call due to mockRejectedValueOnce
            await expect(bundle.write({ format: 'es', dir: tmpDir })).resolves.not.toThrow();
            await bundle.close();
        });
    });

    describe('generate + write - executableFlag: false explicitly', () => {
        let tmpDir;

        beforeEach(async () => {
            tmpDir = await mkdtemp(join(tmpdir(), 'binify-noflag-'));
        });

        afterEach(async () => {
            await rm(tmpDir, { recursive: true, force: true });
        });

        it('should add shebang but skip chmod entirely when executableFlag is false', async () => {
            if (process.platform === 'win32') return;

            // Reset mock to use real implementation, then spy to track calls
            vi.mocked(chmod).mockRestore();
            const chmodSpy = vi.mocked(chmod);

            const callCountBefore = chmodSpy.mock.calls.length;

            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("flag-false")' }), binify({ executableFlag: false })],
            });
            await bundle.write({ format: 'es', dir: tmpDir });

            // chmod should NOT have been called at all (writeBundle skips when executableFlag is false)
            expect(chmodSpy.mock.calls.length).toBe(callCountBefore);

            // But shebang should still be present in the output file
            const { readFile } = await import('node:fs/promises');
            const fileContent = await readFile(join(tmpDir, 'entry.js'), 'utf-8');
            expect(fileContent.startsWith('#!/usr/bin/env node\n')).toBe(true);

            await bundle.close();
        });
    });

    describe('generate - outputOptions without dir', () => {
        it('should resolve file paths correctly when outputOptions uses file instead of dir', async () => {
            const bundle = await rollup({
                input: 'entry',
                plugins: [virtual({ entry: 'console.log("no-dir")' }), binify()],
            });
            // Using file instead of dir -> outputOptions.dir is undefined
            const { output } = await bundle.generate({ format: 'es', file: 'dist/bundle.js' });
            expect(output[0].code.startsWith('#!/usr/bin/env node\n')).toBe(true);
            await bundle.close();
        });
    });

    describe('write - filter false branch in writeBundle', () => {
        let tmpDir;

        beforeEach(async () => {
            tmpDir = await mkdtemp(join(tmpdir(), 'binify-filter-'));
            vi.mocked(chmod).mockRestore();
        });

        afterEach(async () => {
            await rm(tmpDir, { recursive: true, force: true });
        });

        it('should skip chmod for non-matching items in writeBundle', async () => {
            if (process.platform === 'win32') return;

            const bundle = await rollup({
                input: {
                    entry: 'entry',
                    other: 'other',
                },
                plugins: [
                    virtual({
                        entry: 'console.log("entry")',
                        other: 'console.log("other")',
                    }),
                    binify({ filter: item => item.type === 'chunk' && item.fileName === 'entry.js' }),
                ],
            });
            await bundle.write({ format: 'es', dir: tmpDir });

            // entry.js should have shebang and executable permissions
            const entryStat = await stat(join(tmpDir, 'entry.js'));
            expect(entryStat.mode & 0o777).toBe(0o755);

            // other.js should NOT have executable permissions (filter returned false)
            const otherStat = await stat(join(tmpDir, 'other.js'));
            expect(otherStat.mode & 0o777).not.toBe(0o755);

            await bundle.close();
        });
    });

    describe('write - multiple matching entries (countFiles branch)', () => {
        let tmpDir;

        beforeEach(async () => {
            tmpDir = await mkdtemp(join(tmpdir(), 'binify-multi-'));
            vi.mocked(chmod).mockRestore();
        });

        afterEach(async () => {
            await rm(tmpDir, { recursive: true, force: true });
        });

        it('should add shebang and set executable permissions on all matching entry chunks', async () => {
            if (process.platform === 'win32') return;

            const bundle = await rollup({
                input: {
                    a: 'a',
                    b: 'b',
                },
                plugins: [
                    virtual({
                        a: 'console.log("a")',
                        b: 'console.log("b")',
                    }),
                    // Both entries match the default filter (isEntry), so countFiles = 2
                    binify(),
                ],
            });
            await bundle.write({ format: 'es', dir: tmpDir });

            const { readFile } = await import('node:fs/promises');

            const contentA = await readFile(join(tmpDir, 'a.js'), 'utf-8');
            expect(contentA.startsWith('#!/usr/bin/env node\n')).toBe(true);

            const contentB = await readFile(join(tmpDir, 'b.js'), 'utf-8');
            expect(contentB.startsWith('#!/usr/bin/env node\n')).toBe(true);

            const statA = await stat(join(tmpDir, 'a.js'));
            expect(statA.mode & 0o777).toBe(0o755);

            const statB = await stat(join(tmpDir, 'b.js'));
            expect(statB.mode & 0o777).toBe(0o755);

            await bundle.close();
        });
    });
});

// --- VERBOSE BRANCH COVERAGE ---

describe('@rollup-extras/plugin-binify (verbose branch)', () => {
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

    it('should produce correct output when verbose option is enabled', async () => {
        const bundle = await rollup({
            input: 'entry',
            plugins: [virtual({ entry: 'console.log("verbose")' }), binify({ verbose: true })],
        });
        const { output } = await bundle.generate({ format: 'es', dir: 'dist' });
        expect(output[0].code.startsWith('#!/usr/bin/env node\n')).toBe(true);
        await bundle.close();
    });
});
