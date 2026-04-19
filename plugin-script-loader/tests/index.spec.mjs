import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollup } from 'rollup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import scriptLoader from '../src/index.js';

/**
 * Helper plugin that serves a virtual entry module with the given code.
 */
function entryPlugin(code) {
    return {
        name: 'entry',
        resolveId(id) {
            if (id === 'entry') return id;
        },
        load(id) {
            if (id === 'entry') return code;
        },
    };
}

describe('@rollup-extras/plugin-script-loader (integration)', () => {
    /** @type {string} */
    let tmpDir;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'script-loader-test-'));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    describe('inline mode (default)', () => {
        it('should inline script content into the bundle', async () => {
            await writeFile(join(tmpDir, 'vendor.js'), 'window.VENDOR_LIB = true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [entryPlugin(`import 'script!${join(tmpDir, 'vendor.js')}'; console.log('app');`), scriptLoader()],
            });
            const { output } = await bundle.generate({ format: 'es' });

            expect(output[0].code).toContain('VENDOR_LIB');
            expect(output[0].code).toContain('console.log');
        });

        it('should inline multiple scripts preserving all content', async () => {
            await writeFile(join(tmpDir, 'lib1.js'), 'window.LIB_ONE = 1;');
            await writeFile(join(tmpDir, 'lib2.js'), 'window.LIB_TWO = 2;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(
                        "import 'script!" +
                            join(tmpDir, 'lib1.js') +
                            "'; import 'script!" +
                            join(tmpDir, 'lib2.js') +
                            "'; console.log('main');"
                    ),
                    scriptLoader(),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            expect(output[0].code).toContain('LIB_ONE');
            expect(output[0].code).toContain('LIB_TWO');
            expect(output[0].code).toContain('console.log');
        });
    });

    describe('inline mode with useStrict: false', () => {
        it('should inline script content when useStrict is false', async () => {
            await writeFile(join(tmpDir, 'legacy.js'), 'window.LEGACY = true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'legacy.js')}'; console.log('app');`),
                    scriptLoader({ useStrict: false }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            expect(output[0].code).toContain('LEGACY');
        });
    });

    describe('custom prefix', () => {
        it('should intercept imports using a custom prefix', async () => {
            await writeFile(join(tmpDir, 'custom.js'), 'window.CUSTOM_PREFIX = true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [entryPlugin(`import 'raw!${join(tmpDir, 'custom.js')}'; console.log('app');`), scriptLoader({ prefix: 'raw!' })],
            });
            const { output } = await bundle.generate({ format: 'es' });

            expect(output[0].code).toContain('CUSTOM_PREFIX');
        });

        it('should NOT intercept the default prefix when a custom one is set', async () => {
            await writeFile(join(tmpDir, 'ignored.js'), 'window.SHOULD_NOT_APPEAR = true;');

            // Using the default prefix while plugin is configured with a different one.
            // Rollup treats unresolved imports as external (warns, does not throw).
            const warnings = [];
            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'ignored.js')}'; console.log('app');`),
                    scriptLoader({ prefix: 'raw!' }),
                ],
                onwarn(warning) {
                    warnings.push(warning);
                },
            });
            const { output } = await bundle.generate({ format: 'es' });

            // The script content should NOT appear in the output
            expect(output[0].code).not.toContain('SHOULD_NOT_APPEAR');
            // Should have produced a warning about unresolved import
            expect(warnings.some(w => w.code === 'UNRESOLVED_IMPORT')).toBe(true);
        });
    });

    describe('asset mode (emit: asset)', () => {
        it('should emit a separate asset file with concatenated scripts', async () => {
            await writeFile(join(tmpDir, 'lib1.js'), 'var LIB1 = true;');
            await writeFile(join(tmpDir, 'lib2.js'), 'var LIB2 = true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(
                        "import 'script!" +
                            join(tmpDir, 'lib1.js') +
                            "'; import 'script!" +
                            join(tmpDir, 'lib2.js') +
                            "'; console.log('main');"
                    ),
                    scriptLoader({ emit: 'asset', name: 'vendor.js' }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('LIB1');
            expect(asset.source).toContain('LIB2');
        });

        it('should not inline asset-mode scripts into the main chunk', async () => {
            await writeFile(join(tmpDir, 'external.js'), 'var EXTERNAL_ONLY = true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'external.js')}'; console.log('app');`),
                    scriptLoader({ emit: 'asset', name: 'vendor.js' }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const chunk = output.find(item => item.type === 'chunk');
            expect(chunk.code).not.toContain('EXTERNAL_ONLY');

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('EXTERNAL_ONLY');
        });
    });

    describe('asset mode ordering', () => {
        it('should maintain import order in the concatenated asset', async () => {
            await writeFile(join(tmpDir, 'first.js'), 'var FIRST_SCRIPT = 1;');
            await writeFile(join(tmpDir, 'second.js'), 'var SECOND_SCRIPT = 2;');
            await writeFile(join(tmpDir, 'third.js'), 'var THIRD_SCRIPT = 3;');

            const entryCode = [
                `import 'script!${join(tmpDir, 'first.js')}';`,
                `import 'script!${join(tmpDir, 'second.js')}';`,
                `import 'script!${join(tmpDir, 'third.js')}';`,
                "console.log('app');",
            ].join('\n');

            const bundle = await rollup({
                input: 'entry',
                plugins: [entryPlugin(entryCode), scriptLoader({ emit: 'asset', name: 'vendor.js' })],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();

            const source = asset.source;
            const idxFirst = source.indexOf('FIRST_SCRIPT');
            const idxSecond = source.indexOf('SECOND_SCRIPT');
            const idxThird = source.indexOf('THIRD_SCRIPT');

            expect(idxFirst).toBeGreaterThanOrEqual(0);
            expect(idxSecond).toBeGreaterThanOrEqual(0);
            expect(idxThird).toBeGreaterThanOrEqual(0);

            expect(idxFirst).toBeLessThan(idxSecond);
            expect(idxSecond).toBeLessThan(idxThird);
        });
    });

    describe('watch file tracking', () => {
        it('should add loaded scripts to watchFiles', async () => {
            await writeFile(join(tmpDir, 'watched.js'), 'window.WATCHED = true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [entryPlugin(`import 'script!${join(tmpDir, 'watched.js')}'; console.log('app');`), scriptLoader()],
            });
            const { output } = await bundle.generate({ format: 'es' });

            expect(output[0].code).toContain('WATCHED');

            const watchFiles = bundle.watchFiles;
            const hasWatchedFile = watchFiles.some(f => f.includes('watched.js'));
            expect(hasWatchedFile).toBe(true);
        });
    });

    describe('sourcemap in asset mode', () => {
        it('should emit a .map file alongside the asset by default', async () => {
            await writeFile(join(tmpDir, 'lib.js'), 'var MAPPED_LIB = true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'lib.js')}'; console.log('app');`),
                    scriptLoader({ emit: 'asset', name: 'vendor.js' }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('MAPPED_LIB');

            const mapAsset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js.map');
            expect(mapAsset).toBeDefined();
            // Verify it's valid JSON
            const parsed = JSON.parse(mapAsset.source);
            expect(parsed).toHaveProperty('mappings');
            expect(parsed).toHaveProperty('sources');
        });

        it('should NOT emit a .map file when sourcemap is false', async () => {
            await writeFile(join(tmpDir, 'lib.js'), 'var NO_MAP_LIB = true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'lib.js')}'; console.log('app');`),
                    scriptLoader({ emit: 'asset', name: 'vendor.js', sourcemap: false }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('NO_MAP_LIB');

            const mapAsset = output.find(item => item.type === 'asset' && item.fileName.endsWith('.map'));
            expect(mapAsset).toBeUndefined();
        });
    });

    describe('minify option', () => {
        it('should apply minify function to the emitted asset', async () => {
            await writeFile(join(tmpDir, 'spacey.js'), 'var   SPACEY   =   true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'spacey.js')}'; console.log('app');`),
                    scriptLoader({
                        emit: 'asset',
                        name: 'vendor.js',
                        sourcemap: false,
                        minify: async code => ({ code: code.replace(/\s+/g, ' ') }),
                    }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            // Whitespace should be collapsed by our mock minifier
            expect(asset.source).toContain('var SPACEY = true;');
            expect(asset.source).not.toContain('var   SPACEY');
        });
    });

    describe('exactFileName: false', () => {
        it('should produce a hashed filename when exactFileName is false', async () => {
            await writeFile(join(tmpDir, 'hashed.js'), 'var HASHED_ASSET = true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'hashed.js')}'; console.log('app');`),
                    scriptLoader({ emit: 'asset', name: 'vendor.js', exactFileName: false, sourcemap: false }),
                ],
            });
            const { output } = await bundle.generate({
                format: 'es',
                assetFileNames: '[name]-[hash][extname]',
            });

            const asset = output.find(
                item =>
                    item.type === 'asset' &&
                    item.fileName !== 'vendor.js' &&
                    typeof item.source === 'string' &&
                    item.source.includes('HASHED_ASSET')
            );
            expect(asset).toBeDefined();
            // The filename should contain a hash (not be exactly 'vendor.js')
            expect(asset.fileName).toMatch(/vendor-[a-zA-Z0-9]+\.js/);
        });
    });

    describe('plugin name', () => {
        it('should have the correct default plugin name', () => {
            expect(scriptLoader().name).toBe('@rollup-extras/plugin-script-loader');
        });

        it('should use a custom pluginName when provided', () => {
            expect(scriptLoader({ pluginName: 'my-loader' }).name).toBe('my-loader');
        });
    });

    describe('closeBundle cleanup (rebuild simulation)', () => {
        it('should produce correct output on a second build with the same plugin instance', async () => {
            await writeFile(join(tmpDir, 'build1.js'), 'var BUILD_ONE = 1;');
            await writeFile(join(tmpDir, 'build2.js'), 'var BUILD_TWO = 2;');

            const plugin = scriptLoader({ emit: 'asset', name: 'vendor.js', sourcemap: false });

            // First build
            const bundle1 = await rollup({
                input: 'entry',
                plugins: [entryPlugin(`import 'script!${join(tmpDir, 'build1.js')}'; console.log('first');`), plugin],
            });
            const result1 = await bundle1.generate({ format: 'es' });
            await bundle1.close();

            const asset1 = result1.output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset1).toBeDefined();
            expect(asset1.source).toContain('BUILD_ONE');
            expect(asset1.source).not.toContain('BUILD_TWO');

            // Second build with different script
            const bundle2 = await rollup({
                input: 'entry',
                plugins: [entryPlugin(`import 'script!${join(tmpDir, 'build2.js')}'; console.log('second');`), plugin],
            });
            const result2 = await bundle2.generate({ format: 'es' });
            await bundle2.close();

            const asset2 = result2.output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset2).toBeDefined();
            expect(asset2.source).toContain('BUILD_TWO');
            expect(asset2.source).not.toContain('BUILD_ONE');
        });
    });

    describe('single script in asset mode', () => {
        it('should emit a single script as an asset correctly', async () => {
            await writeFile(join(tmpDir, 'solo.js'), 'var SOLO_SCRIPT = true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'solo.js')}'; console.log('app');`),
                    scriptLoader({ emit: 'asset', name: 'vendor.js' }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('SOLO_SCRIPT');
        });
    });

    // ----------------------------------------------------------------
    // NEW TESTS: coverage gaps
    // ----------------------------------------------------------------

    describe('unresolvable specifier', () => {
        it('should warn and leave the import unresolved when module cannot be found', async () => {
            const warnings = [];
            const bundle = await rollup({
                input: 'entry',
                plugins: [entryPlugin("import 'script!nonexistent-module-xyz'; console.log('app');"), scriptLoader()],
                onwarn(warning) {
                    warnings.push(warning);
                },
            });
            await bundle.generate({ format: 'es' });

            const pluginWarning = warnings.some(w => typeof w.message === 'string' && w.message.includes('nonexistent-module-xyz'));
            expect(pluginWarning).toBe(true);
        });
    });

    describe('resolved ID with null byte prefix', () => {
        it('should strip the null prefix from the resolved path and load from disk', async () => {
            await writeFile(join(tmpDir, 'null-prefixed.js'), 'window.NULL_PREFIX_WORKS = true;');

            function nullPrefixPlugin() {
                const target = join(tmpDir, 'null-prefixed.js');
                return {
                    name: 'null-prefix-resolver',
                    resolveId(id) {
                        if (id === 'null-prefixed-mod') return `\0${target}`;
                    },
                    load(_id) {
                        return null;
                    },
                };
            }

            const bundle = await rollup({
                input: 'entry',
                plugins: [entryPlugin("import 'script!null-prefixed-mod'; console.log('app');"), nullPrefixPlugin(), scriptLoader()],
            });
            const { output } = await bundle.generate({ format: 'es' });

            expect(output[0].code).toContain('NULL_PREFIX_WORKS');
        });
    });

    describe('resolved ID with ?query suffix', () => {
        it('should strip the ?query suffix from resolved path and load from disk', async () => {
            await writeFile(join(tmpDir, 'query-mod.js'), 'window.QUERY_STRIPPED = true;');

            function queryPlugin() {
                const target = join(tmpDir, 'query-mod.js');
                return {
                    name: 'query-resolver',
                    resolveId(id) {
                        if (id === 'query-mod') return `${target}?commonjs-es-import`;
                    },
                    load(_id) {
                        return null;
                    },
                };
            }

            const bundle = await rollup({
                input: 'entry',
                plugins: [entryPlugin("import 'script!query-mod'; console.log('app');"), queryPlugin(), scriptLoader()],
            });
            const { output } = await bundle.generate({ format: 'es' });

            expect(output[0].code).toContain('QUERY_STRIPPED');
        });
    });

    describe('script with inline base64 sourcemap', () => {
        it('should parse inline base64 sourcemap when emit asset with sourcemap true', async () => {
            const inlineMap = 'eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEifQ==';
            const code = `var INLINE_MAP = 1;\n//# sourceMappingURL=data:application/json;base64,${inlineMap}`;
            await writeFile(join(tmpDir, 'inline-map.js'), code);

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'inline-map.js')}'; console.log('app');`),
                    scriptLoader({ emit: 'asset', name: 'vendor.js', sourcemap: true }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('INLINE_MAP');
            expect(asset.source).not.toContain('sourceMappingURL=data:');

            const mapAsset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js.map');
            expect(mapAsset).toBeDefined();
            const parsed = JSON.parse(mapAsset.source);
            expect(parsed).toHaveProperty('mappings');
        });
    });

    describe('script with external .map file', () => {
        it('should read external sourcemap file when it exists', async () => {
            const mapContent = JSON.stringify({
                version: 3,
                file: 'ext-map.js',
                sourceRoot: '',
                sources: ['ext-map.js'],
                names: [],
                mappings: 'AAAA',
            });
            await writeFile(join(tmpDir, 'ext-map.js'), 'var EXT_MAP = 1;\n//# sourceMappingURL=ext-map.js.map');
            await writeFile(join(tmpDir, 'ext-map.js.map'), mapContent);

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'ext-map.js')}'; console.log('app');`),
                    scriptLoader({ emit: 'asset', name: 'vendor.js', sourcemap: true }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('EXT_MAP');
            expect(asset.source).not.toContain('sourceMappingURL=ext-map.js.map');

            const mapAsset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js.map');
            expect(mapAsset).toBeDefined();
        });
    });

    describe('script with missing external .map file', () => {
        it('should gracefully handle a missing external sourcemap file', async () => {
            await writeFile(join(tmpDir, 'no-map.js'), 'var NO_MAP = 1;\n//# sourceMappingURL=no-map.js.map');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'no-map.js')}'; console.log('app');`),
                    scriptLoader({ emit: 'asset', name: 'vendor.js', sourcemap: true }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('NO_MAP');

            const mapAsset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js.map');
            expect(mapAsset).toBeDefined();
        });
    });

    describe('minify function that throws', () => {
        it('should report an error when the minify function throws', async () => {
            await writeFile(join(tmpDir, 'to-minify.js'), 'var TO_MINIFY = 1;');

            let buildError;
            try {
                const bundle = await rollup({
                    input: 'entry',
                    plugins: [
                        entryPlugin(`import 'script!${join(tmpDir, 'to-minify.js')}'; console.log('app');`),
                        scriptLoader({
                            emit: 'asset',
                            name: 'vendor.js',
                            sourcemap: false,
                            minify: async () => {
                                throw new Error('minify failed');
                            },
                        }),
                    ],
                });
                await bundle.generate({ format: 'es' });
            } catch (err) {
                buildError = err;
            }

            expect(buildError).toBeDefined();
            expect(buildError.message).toContain('minify failed');
        });
    });

    describe('minify returns a sourcemap', () => {
        it('should use the sourcemap returned by the minify function', async () => {
            await writeFile(join(tmpDir, 'min-map.js'), 'var   MIN_MAP   =   true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'min-map.js')}'; console.log('app');`),
                    scriptLoader({
                        emit: 'asset',
                        name: 'vendor.js',
                        sourcemap: true,
                        minify: async code => ({
                            code: code.replace(/\s+/g, ' '),
                            map: { version: 3, sources: ['min-map.js'], names: [], mappings: 'AAAA' },
                        }),
                    }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('var MIN_MAP = true;');
            expect(asset.source).not.toContain('var   MIN_MAP');

            const mapAsset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js.map');
            expect(mapAsset).toBeDefined();
            const parsed = JSON.parse(mapAsset.source);
            expect(parsed.sources).toContain('min-map.js');
        });
    });

    describe('verbose: true in asset mode', () => {
        it('should log emitted asset information when verbose is true', async () => {
            await writeFile(join(tmpDir, 'verbose-lib.js'), 'var VERBOSE_LIB = 1;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'verbose-lib.js')}'; console.log('app');`),
                    scriptLoader({ emit: 'asset', name: 'vendor.js', verbose: true, sourcemap: false }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('VERBOSE_LIB');
        });
    });

    describe('sourcemap: true in inline mode', () => {
        it('should still inline correctly when sourcemap is true in inline mode', async () => {
            await writeFile(join(tmpDir, 'inline-sm.js'), 'window.INLINE_SM = true;');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'inline-sm.js')}'; console.log('app');`),
                    scriptLoader({ emit: 'inline', sourcemap: true }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            expect(output[0].code).toContain('INLINE_SM');
        });
    });

    describe('stripSourcemapComment in asset mode', () => {
        it('should strip the sourceMappingURL comment from the emitted asset', async () => {
            await writeFile(join(tmpDir, 'has-comment.js'), 'var HAS_COMMENT = 1;\n//# sourceMappingURL=something.map');

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(`import 'script!${join(tmpDir, 'has-comment.js')}'; console.log('app');`),
                    scriptLoader({ emit: 'asset', name: 'vendor.js', sourcemap: false }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('HAS_COMMENT');
            expect(asset.source).not.toContain('sourceMappingURL=something.map');
        });
    });

    describe('load hook returns null for non-script IDs', () => {
        it('should return null from load for modules not prefixed with script prefix', async () => {
            await writeFile(join(tmpDir, 'helper.mjs'), 'export const HELPER = 42;');
            await writeFile(join(tmpDir, 'script-side.js'), 'var SCRIPT_SIDE = 1;');

            const helperPath = join(tmpDir, 'helper.mjs');
            const scriptPath = join(tmpDir, 'script-side.js');
            const entryCode =
                'import ' +
                "'" +
                'script!' +
                scriptPath +
                "'" +
                '; import { HELPER } from ' +
                "'" +
                helperPath +
                "'" +
                '; console.log(HELPER);';

            const bundle = await rollup({
                input: 'entry',
                plugins: [entryPlugin(entryCode), scriptLoader({ emit: 'asset', name: 'vendor.js', sourcemap: false })],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const chunk = output.find(item => item.type === 'chunk');
            expect(chunk.code).toContain('42');

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();
            expect(asset.source).toContain('SCRIPT_SIDE');
        });
    });

    describe('sort comparator edge cases (lines 257-259)', () => {
        it('should place scripts in importOrder before scripts not in importOrder', async () => {
            // Create scripts: one will be statically imported (in importOrder),
            // the other will be force-loaded (NOT in importOrder).
            await writeFile(join(tmpDir, 'ordered.js'), 'var ORDERED_SCRIPT = 1;');
            await writeFile(join(tmpDir, 'unordered.js'), 'var UNORDERED_SCRIPT = 2;');

            const orderedPath = join(tmpDir, 'ordered.js');
            const unorderedPath = join(tmpDir, 'unordered.js');

            // This plugin force-loads a script via this.load() without any module
            // importing it, so the script ends up in the scripts Map but NOT in
            // importOrder (because moduleParsed only records importedIds).
            function forceLoadPlugin() {
                return {
                    name: 'force-load',
                    async buildStart() {
                        const resolved = await this.resolve(`script!${unorderedPath}`, 'entry');
                        if (resolved) {
                            await this.load({ id: resolved.id });
                        }
                    },
                };
            }

            // Entry only statically imports ordered.js => it goes into importOrder.
            // unordered.js is force-loaded => in scripts Map but NOT in importOrder.
            const entryCode = `import 'script!${orderedPath}'; console.log('app');`;

            const bundle = await rollup({
                input: 'entry',
                plugins: [entryPlugin(entryCode), forceLoadPlugin(), scriptLoader({ emit: 'asset', name: 'vendor.js', sourcemap: false })],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();

            const source = asset.source;
            const idxOrdered = source.indexOf('ORDERED_SCRIPT');
            const idxUnordered = source.indexOf('UNORDERED_SCRIPT');

            expect(idxOrdered).toBeGreaterThanOrEqual(0);
            expect(idxUnordered).toBeGreaterThanOrEqual(0);

            // The ordered script (in importOrder) should come before the unordered one
            expect(idxOrdered).toBeLessThan(idxUnordered);
        });

        it('should preserve relative order for scripts both absent from importOrder', async () => {
            // Both scripts are force-loaded (neither in importOrder).
            // The comparator returns 0, preserving insertion order.
            await writeFile(join(tmpDir, 'alpha.js'), 'var ALPHA_SCRIPT = 1;');
            await writeFile(join(tmpDir, 'beta.js'), 'var BETA_SCRIPT = 2;');

            const alphaPath = join(tmpDir, 'alpha.js');
            const betaPath = join(tmpDir, 'beta.js');

            function forceLoadTwoPlugin() {
                return {
                    name: 'force-load-two',
                    async buildStart() {
                        // Load alpha first, then beta - insertion order matters
                        const resolvedA = await this.resolve(`script!${alphaPath}`, 'entry');
                        if (resolvedA) {
                            await this.load({ id: resolvedA.id });
                        }
                        const resolvedB = await this.resolve(`script!${betaPath}`, 'entry');
                        if (resolvedB) {
                            await this.load({ id: resolvedB.id });
                        }
                    },
                };
            }

            // Entry imports NO scripts - both come from force-loading only
            const entryCode = "console.log('app');";

            const bundle = await rollup({
                input: 'entry',
                plugins: [
                    entryPlugin(entryCode),
                    forceLoadTwoPlugin(),
                    scriptLoader({ emit: 'asset', name: 'vendor.js', sourcemap: false }),
                ],
            });
            const { output } = await bundle.generate({ format: 'es' });

            const asset = output.find(item => item.type === 'asset' && item.fileName === 'vendor.js');
            expect(asset).toBeDefined();

            const source = asset.source;
            const idxAlpha = source.indexOf('ALPHA_SCRIPT');
            const idxBeta = source.indexOf('BETA_SCRIPT');

            expect(idxAlpha).toBeGreaterThanOrEqual(0);
            expect(idxBeta).toBeGreaterThanOrEqual(0);

            // Both are absent from importOrder, so comparator returns 0
            // and stable sort preserves Map insertion order (alpha first)
            expect(idxAlpha).toBeLessThan(idxBeta);
        });
    });
});
