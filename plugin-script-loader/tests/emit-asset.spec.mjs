import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerStart = vi.fn();
const loggerFinish = vi.fn();
const loggerFn = Object.assign(vi.fn(), { start: loggerStart, finish: loggerFinish });

vi.mock('@niceties/logger', () => ({
    LogLevel: { info: 'info', verbose: 'verbose' },
    createLogger: () => loggerFn,
    default: () => loggerFn,
}));

vi.mock('node:fs/promises', () => ({
    readFile: vi.fn(async (path, encoding) => {
        const files = {
            '/resolved/d3.js': 'window.d3 = {};',
            '/resolved/angular.js': 'window.angular = {};',
            '/resolved/legacy.js': 'var Legacy = true;',
            '/resolved/lib1.js': 'var lib1 = 1;',
            '/resolved/lib2.js': 'var lib2 = 2;',
            '/resolved/lib3.js': 'var lib3 = 3;',
            '/resolved/lib4.js': 'var lib4 = 4;',
            '/resolved/lib5.js': 'var lib5 = 5;',
            '/resolved/lib6.js': 'var lib6 = 6;',
            '/resolved/with-inline-map.js':
                'var foo = 1;\n//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSJ9',
            '/resolved/with-external-map.js': 'var bar = 2;\n//# sourceMappingURL=with-external-map.js.map',
            '/resolved/with-external-map.js.map': JSON.stringify({
                version: 3,
                sources: ['bar.js'],
                names: [],
                mappings: 'AAAA',
            }),
        };

        if (path in files) {
            const content = files[path];
            return encoding === 'utf8' ? content : Buffer.from(content);
        }
        throw new Error(`ENOENT: ${path}`);
    }),
}));

const { default: scriptLoader } = await import('../src/index.js');

describe('@rollup-extras/plugin-script-loader emit asset mode', () => {
    /** @type {ReturnType<typeof scriptLoader>} */
    let plugin;

    /** @type {any} */
    let context;

    /** @type {Record<string, { type: string, source?: string, fileName?: string }>} */
    let bundle;

    /** @type {Array<{ type: string, fileName?: string, name?: string, source: string }>} */
    let emittedFiles;

    /** @type {Map<string, string>} */
    let fileNameMap;

    beforeEach(() => {
        vi.clearAllMocks();
        emittedFiles = [];
        fileNameMap = new Map();
        bundle = {};

        context = {
            resolve: vi.fn(async source => {
                if (source === 'd3') return { id: '/resolved/d3.js' };
                if (source === 'angular') return { id: '/resolved/angular.js' };
                if (source === './vendor/legacy.js') return { id: '/resolved/legacy.js' };
                if (source === 'with-inline-map') return { id: '/resolved/with-inline-map.js' };
                if (source === 'with-external-map') return { id: '/resolved/with-external-map.js' };
                if (source === 'lib1') return { id: '/resolved/lib1.js' };
                if (source === 'lib2') return { id: '/resolved/lib2.js' };
                if (source === 'lib3') return { id: '/resolved/lib3.js' };
                if (source === 'lib4') return { id: '/resolved/lib4.js' };
                if (source === 'lib5') return { id: '/resolved/lib5.js' };
                if (source === 'lib6') return { id: '/resolved/lib6.js' };
                return null;
            }),
            warn: vi.fn(),
            error: vi.fn(msg => {
                throw new Error(msg);
            }),
            addWatchFile: vi.fn(),
            emitFile: vi.fn(fileInfo => {
                emittedFiles.push(fileInfo);
                const refId = `ref-${emittedFiles.length}`;
                let finalFileName;

                if (fileInfo.fileName) {
                    finalFileName = fileInfo.fileName;
                } else if (fileInfo.name) {
                    // Simulate Rollup's hashing behavior
                    const baseName = fileInfo.name.replace('.js', '');
                    finalFileName = `assets/${baseName}.abc123.js`;
                }

                fileNameMap.set(refId, finalFileName);
                bundle[finalFileName] = {
                    type: 'asset',
                    source: fileInfo.source,
                    fileName: finalFileName,
                };

                return refId;
            }),
            getFileName: vi.fn(refId => fileNameMap.get(refId)),
        };
    });

    describe('emit: "asset" option', () => {
        beforeEach(() => {
            plugin = scriptLoader({ emit: 'asset' });
        });

        it('should return placeholder code in load hook', async () => {
            const resolved = await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {});
            const result = await plugin.load.call(context, resolved.id);

            expect(result.code).toBe('/* [script-loader] externalized: /resolved/d3.js */\n');
            expect(result.moduleSideEffects).toBe(true);
        });

        it('should emit concatenated asset in generateBundle', async () => {
            // Resolve and load multiple scripts
            const id1 = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            const id2 = (await plugin.resolveId.call(context, 'script!angular', '/src/index.js', {})).id;

            await plugin.load.call(context, id1);
            await plugin.load.call(context, id2);

            // Generate bundle
            await plugin.generateBundle.call(context, {}, bundle);

            // Should have emitted the main asset and sourcemap
            expect(emittedFiles.length).toBe(2);

            const mainAsset = emittedFiles[0];
            expect(mainAsset.fileName).toBe('vendor.js');
            expect(mainAsset.source).toContain('window.d3 = {};');
            expect(mainAsset.source).toContain('window.angular = {};');
        });

        it('should emit asset with default name "vendor.js"', async () => {
            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];
            expect(mainAsset.fileName).toBe('vendor.js');
        });

        it('should not emit anything when no scripts collected', async () => {
            await plugin.generateBundle.call(context, {}, bundle);
            expect(emittedFiles.length).toBe(0);
        });
    });

    describe('ordering preservation', () => {
        beforeEach(() => {
            plugin = scriptLoader({ emit: 'asset' });
        });

        it('should concatenate scripts in import order', async () => {
            // Resolve and load in specific order
            const id1 = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            const id2 = (await plugin.resolveId.call(context, 'script!angular', '/src/index.js', {})).id;
            const id3 = (await plugin.resolveId.call(context, 'script!./vendor/legacy.js', '/src/index.js', {})).id;

            await plugin.load.call(context, id1);
            await plugin.load.call(context, id2);
            await plugin.load.call(context, id3);

            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];
            const d3Index = mainAsset.source.indexOf('window.d3');
            const angularIndex = mainAsset.source.indexOf('window.angular');
            const legacyIndex = mainAsset.source.indexOf('Legacy');

            expect(d3Index).toBeLessThan(angularIndex);
            expect(angularIndex).toBeLessThan(legacyIndex);
        });

        it('should assign unique order numbers to each script', async () => {
            // Resolve same file twice (should only count once)
            const id1 = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            const id1Again = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;

            expect(id1).toBe(id1Again);
        });
    });

    describe('name option', () => {
        it('should use custom name for emitted asset', async () => {
            plugin = scriptLoader({ emit: 'asset', name: 'legacy-bundle.js' });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];
            expect(mainAsset.fileName).toBe('legacy-bundle.js');
        });
    });

    describe('exactFileName option', () => {
        it('should use fileName (exact) when exactFileName: true (default)', async () => {
            plugin = scriptLoader({ emit: 'asset' });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];
            expect(mainAsset.fileName).toBe('vendor.js');
            expect(mainAsset.name).toBeUndefined();
        });

        it('should use name (hashed) when exactFileName: false', async () => {
            plugin = scriptLoader({ emit: 'asset', exactFileName: false });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];
            expect(mainAsset.name).toBe('vendor.js');
            expect(mainAsset.fileName).toBeUndefined();
        });
    });

    describe('sourcemap generation', () => {
        beforeEach(() => {
            plugin = scriptLoader({ emit: 'asset', sourcemap: true });
        });

        it('should emit sourcemap when sourcemap: true', async () => {
            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            expect(emittedFiles.length).toBe(2);
            const mapAsset = emittedFiles[1];
            expect(mapAsset.fileName).toBe('vendor.js.map');
        });

        it('should include sourceMappingURL in emitted asset', async () => {
            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            // Check that bundle was modified to include sourceMappingURL
            const finalBundle = bundle['vendor.js'];
            expect(finalBundle.source).toContain('//# sourceMappingURL=vendor.js.map');
        });

        it('should generate valid sourcemap JSON', async () => {
            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            const mapAsset = emittedFiles[1];
            const sourcemap = JSON.parse(mapAsset.source);

            expect(sourcemap.version).toBe(3);
            expect(sourcemap.sources).toContain('/resolved/d3.js');
            expect(sourcemap.file).toBe('vendor.js');
        });

        it('should not emit sourcemap when sourcemap: false', async () => {
            plugin = scriptLoader({ emit: 'asset', sourcemap: false });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            expect(emittedFiles.length).toBe(1);
        });

        it('should default sourcemap to true for emit: "asset"', async () => {
            plugin = scriptLoader({ emit: 'asset' }); // no explicit sourcemap option

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            expect(emittedFiles.length).toBe(2); // main + map
        });

        it('should strip existing sourceMappingURL from source files', async () => {
            const id = (await plugin.resolveId.call(context, 'script!with-inline-map', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];
            expect(mainAsset.source).not.toContain('data:application/json;base64');
            expect(mainAsset.source).toContain('var foo = 1;');
        });

        it('should read external sourcemap files', async () => {
            const id = (await plugin.resolveId.call(context, 'script!with-external-map', '/src/index.js', {})).id;
            // Simulate moduleParsed to track import order
            plugin.moduleParsed({ importedIds: [id] });
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];
            // Should strip sourceMappingURL from output
            expect(mainAsset.source).not.toContain('sourceMappingURL=with-external-map.js.map');
            expect(mainAsset.source).toContain('var bar = 2;');
        });

        it('should handle hashed filenames with exactFileName: false', async () => {
            plugin = scriptLoader({ emit: 'asset', exactFileName: false, sourcemap: true });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            // Sourcemap filename should match hashed main filename
            const mapAsset = emittedFiles[1];
            expect(mapAsset.fileName).toBe('assets/vendor.abc123.js.map');
        });
    });

    describe('minification', () => {
        it('should call minify function with code and sourcemap', async () => {
            const minifyFn = vi.fn(async (code, map) => ({
                code: code.replace(/\s+/g, ''),
                map: map,
            }));

            plugin = scriptLoader({ emit: 'asset', minify: minifyFn });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            expect(minifyFn).toHaveBeenCalledTimes(1);
            expect(minifyFn).toHaveBeenCalledWith(expect.stringContaining('window.d3'), expect.any(Object));
        });

        it('should use minified code in output', async () => {
            const minifyFn = vi.fn(async _code => ({
                code: 'MINIFIED',
            }));

            plugin = scriptLoader({ emit: 'asset', minify: minifyFn, sourcemap: false });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];
            expect(mainAsset.source).toBe('MINIFIED');
        });

        it('should handle minification errors', async () => {
            const minifyFn = vi.fn(async () => {
                throw new Error('Minification error');
            });

            plugin = scriptLoader({ emit: 'asset', minify: minifyFn });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            plugin.moduleParsed({ importedIds: [id] });
            await plugin.load.call(context, id);

            await expect(plugin.generateBundle.call(context, {}, bundle)).rejects.toThrow('Minification failed');
        });

        it('should handle non-Error minification throws', async () => {
            const minifyFn = vi.fn(async () => {
                throw 'string error';
            });

            plugin = scriptLoader({ emit: 'asset', minify: minifyFn });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            plugin.moduleParsed({ importedIds: [id] });
            await plugin.load.call(context, id);

            await expect(plugin.generateBundle.call(context, {}, bundle)).rejects.toThrow('Minification failed: string error');
        });

        it('should update sourcemap from minifier result', async () => {
            const customMap = {
                version: 3,
                sources: ['custom.js'],
                names: [],
                mappings: 'AAAA',
                file: 'vendor.js',
            };

            const minifyFn = vi.fn(async () => ({
                code: 'minified()',
                map: customMap,
            }));

            plugin = scriptLoader({ emit: 'asset', minify: minifyFn });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            const mapAsset = emittedFiles[1];
            const sourcemap = JSON.parse(mapAsset.source);
            expect(sourcemap.sources).toContain('custom.js');
        });
    });

    describe('moduleParsed hook', () => {
        beforeEach(() => {
            plugin = scriptLoader({ emit: 'asset' });
        });

        it('should track import order from moduleParsed', async () => {
            // Resolve scripts
            const id1 = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            const id2 = (await plugin.resolveId.call(context, 'script!angular', '/src/index.js', {})).id;

            // Simulate moduleParsed with specific order
            plugin.moduleParsed({ importedIds: [id1, id2] });

            // Load in reverse order
            await plugin.load.call(context, id2);
            await plugin.load.call(context, id1);

            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];
            const d3Index = mainAsset.source.indexOf('window.d3');
            const angularIndex = mainAsset.source.indexOf('window.angular');

            // Should be sorted by moduleParsed order, not load order
            expect(d3Index).toBeLessThan(angularIndex);
        });

        it('should not track imports when emit is inline', async () => {
            plugin = scriptLoader({ emit: 'inline' });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;

            // This should be a no-op for inline mode
            plugin.moduleParsed({ importedIds: [id] });

            // Load should return inlined code, not placeholder
            const result = await plugin.load.call(context, id);
            expect(result.code).toContain('window.d3');
        });

        it('should ignore non-script-loader imports in moduleParsed', async () => {
            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;

            // moduleParsed with mixed imports
            plugin.moduleParsed({ importedIds: ['/some/regular/module.js', id, '/another/module.js'] });

            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            // Should still work correctly
            expect(emittedFiles.length).toBe(2);
        });

        it('should not duplicate imports in order tracking', async () => {
            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;

            // Call moduleParsed multiple times with same ID
            plugin.moduleParsed({ importedIds: [id] });
            plugin.moduleParsed({ importedIds: [id] });

            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            // Should only appear once
            const mainAsset = emittedFiles[0];
            const matches = mainAsset.source.match(/window\.d3/g);
            expect(matches).toHaveLength(1);
        });
    });

    describe('sorting edge cases', () => {
        beforeEach(() => {
            plugin = scriptLoader({ emit: 'asset' });
        });

        it('should handle scripts not in importOrder (fallback to Map order)', async () => {
            // Load scripts without calling moduleParsed
            const id1 = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            const id2 = (await plugin.resolveId.call(context, 'script!angular', '/src/index.js', {})).id;

            await plugin.load.call(context, id1);
            await plugin.load.call(context, id2);

            await plugin.generateBundle.call(context, {}, bundle);

            // Should still emit both scripts
            const mainAsset = emittedFiles[0];
            expect(mainAsset.source).toContain('window.d3');
            expect(mainAsset.source).toContain('window.angular');
        });

        it('should sort correctly when only first script is in importOrder', async () => {
            const id1 = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            const id2 = (await plugin.resolveId.call(context, 'script!angular', '/src/index.js', {})).id;

            // Only add id1 to importOrder
            plugin.moduleParsed({ importedIds: [id1] });

            await plugin.load.call(context, id1);
            await plugin.load.call(context, id2);

            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];
            const d3Index = mainAsset.source.indexOf('window.d3');
            const angularIndex = mainAsset.source.indexOf('window.angular');

            // id1 (d3) is in importOrder, so it should come first
            expect(d3Index).toBeLessThan(angularIndex);
        });

        it('should sort correctly when only second script is in importOrder', async () => {
            const id1 = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            const id2 = (await plugin.resolveId.call(context, 'script!angular', '/src/index.js', {})).id;

            // Only add id2 to importOrder
            plugin.moduleParsed({ importedIds: [id2] });

            await plugin.load.call(context, id1);
            await plugin.load.call(context, id2);

            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];
            const d3Index = mainAsset.source.indexOf('window.d3');
            const angularIndex = mainAsset.source.indexOf('window.angular');

            // id2 (angular) is in importOrder, so it should come first
            expect(angularIndex).toBeLessThan(d3Index);
        });
    });

    describe('closeBundle cleanup', () => {
        it('should clear state in closeBundle for watch mode support', async () => {
            plugin = scriptLoader({ emit: 'asset' });

            // First build
            const id1 = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id1);
            await plugin.generateBundle.call(context, {}, bundle);

            expect(emittedFiles.length).toBe(2);

            // Simulate closeBundle
            plugin.closeBundle.call(context);

            // Clear emitted files for second build
            emittedFiles = [];
            bundle = {};

            // Second build - should start fresh
            await plugin.generateBundle.call(context, {}, bundle);

            // Should not emit anything since state was cleared
            expect(emittedFiles.length).toBe(0);
        });
    });

    describe('emit: "inline" mode (default)', () => {
        beforeEach(() => {
            plugin = scriptLoader(); // default emit: 'inline'
        });

        it('should not emit asset for emit: "inline"', async () => {
            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            expect(emittedFiles.length).toBe(0);
        });

        it('should return inlined code in load hook', async () => {
            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            const result = await plugin.load.call(context, id);

            expect(result.code).toBe('window.d3 = {};\nexport {}\n');
        });
    });

    describe('verbose logging', () => {
        it('should log emitted files when verbose: true', async () => {
            plugin = scriptLoader({ emit: 'asset', verbose: true });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            await plugin.load.call(context, id);
            await plugin.generateBundle.call(context, {}, bundle);

            expect(loggerFn).toHaveBeenCalledWith(expect.stringContaining('vendor.js'), expect.any(String));
        });
    });

    describe('statistics edge cases', () => {
        it('should handle more than 5 scripts (statistics count mode)', async () => {
            plugin = scriptLoader({ emit: 'asset', sourcemap: false });

            // Load 6 scripts to trigger statistics count mode
            const ids = [];
            for (const lib of ['d3', 'angular', 'lib1', 'lib2', 'lib3', 'lib4']) {
                const id = (await plugin.resolveId.call(context, `script!${lib}`, '/src/index.js', {})).id;
                ids.push(id);
            }

            plugin.moduleParsed({ importedIds: ids });

            for (const id of ids) {
                await plugin.load.call(context, id);
            }

            await plugin.generateBundle.call(context, {}, bundle);

            // Should emit the asset with all 6 scripts
            expect(emittedFiles.length).toBe(1);
            const mainAsset = emittedFiles[0];
            expect(mainAsset.source).toContain('window.d3');
            expect(mainAsset.source).toContain('window.angular');
            expect(mainAsset.source).toContain('var lib4');
        });
    });

    describe('bundle entry edge cases', () => {
        it('should handle missing bundle entry gracefully', async () => {
            plugin = scriptLoader({ emit: 'asset', sourcemap: true });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            plugin.moduleParsed({ importedIds: [id] });
            await plugin.load.call(context, id);

            // Create a bundle that doesn't have the emitted file
            const emptyBundle = {};

            // Override emitFile to not populate the bundle
            const originalEmitFile = context.emitFile;
            context.emitFile = vi.fn(fileInfo => {
                const refId = originalEmitFile(fileInfo);
                // Don't actually add to emptyBundle
                return refId;
            });

            await plugin.generateBundle.call(context, {}, emptyBundle);

            // Should complete without error even if bundle entry is missing
            expect(context.emitFile).toHaveBeenCalled();
        });

        it('should handle bundle entry with non-string source', async () => {
            plugin = scriptLoader({ emit: 'asset', sourcemap: true });

            const id = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            plugin.moduleParsed({ importedIds: [id] });
            await plugin.load.call(context, id);

            // Create a bundle where source is Uint8Array instead of string
            const customBundle = {};
            const _originalEmitFile = context.emitFile;
            context.emitFile = vi.fn(fileInfo => {
                emittedFiles.push(fileInfo);
                const refId = `ref-${emittedFiles.length}`;
                const finalFileName = fileInfo.fileName || `assets/${fileInfo.name.replace('.js', '')}.abc123.js`;
                fileNameMap.set(refId, finalFileName);
                customBundle[finalFileName] = {
                    type: 'asset',
                    source: new Uint8Array([1, 2, 3]), // Non-string source
                    fileName: finalFileName,
                };
                return refId;
            });

            await plugin.generateBundle.call(context, {}, customBundle);

            // Should complete without error
            expect(emittedFiles.length).toBe(2);
        });
    });

    describe('multiple files concatenation', () => {
        beforeEach(() => {
            plugin = scriptLoader({ emit: 'asset' });
        });

        it('should concatenate multiple files with newlines', async () => {
            const id1 = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            const id2 = (await plugin.resolveId.call(context, 'script!angular', '/src/index.js', {})).id;
            const id3 = (await plugin.resolveId.call(context, 'script!./vendor/legacy.js', '/src/index.js', {})).id;

            await plugin.load.call(context, id1);
            await plugin.load.call(context, id2);
            await plugin.load.call(context, id3);

            await plugin.generateBundle.call(context, {}, bundle);

            const mainAsset = emittedFiles[0];

            // All three scripts should be present
            expect(mainAsset.source).toContain('window.d3 = {};');
            expect(mainAsset.source).toContain('window.angular = {};');
            expect(mainAsset.source).toContain('var Legacy = true;');
        });

        it('should include all sources in sourcemap', async () => {
            const id1 = (await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {})).id;
            const id2 = (await plugin.resolveId.call(context, 'script!angular', '/src/index.js', {})).id;

            await plugin.load.call(context, id1);
            await plugin.load.call(context, id2);

            await plugin.generateBundle.call(context, {}, bundle);

            const mapAsset = emittedFiles[1];
            const sourcemap = JSON.parse(mapAsset.source);

            expect(sourcemap.sources).toContain('/resolved/d3.js');
            expect(sourcemap.sources).toContain('/resolved/angular.js');
        });
    });
});
