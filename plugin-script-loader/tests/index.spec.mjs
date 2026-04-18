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
    readFile: vi.fn(async path => {
        if (path === '/resolved/d3.js') {
            return Buffer.from('window.d3 = {};');
        }
        if (path === '/resolved/angular.js') {
            return Buffer.from('window.angular = {};');
        }
        if (path === '/resolved/legacy.js') {
            return Buffer.from('var Legacy = true;');
        }
        throw new Error(`ENOENT: ${path}`);
    }),
}));

const { default: scriptLoader } = await import('../src/index.js');

describe('@rollup-extras/plugin-script-loader', () => {
    /** @type {ReturnType<typeof scriptLoader>} */
    let plugin;

    /** @type {{ resolve: Function, warn: Function, addWatchFile: Function }} */
    let context;

    beforeEach(() => {
        vi.clearAllMocks();
        plugin = scriptLoader();
        context = {
            resolve: vi.fn(async source => {
                if (source === 'd3') return { id: '/resolved/d3.js' };
                if (source === 'angular') return { id: '/resolved/angular.js' };
                if (source === './vendor/legacy.js') return { id: '/resolved/legacy.js' };
                if (source === 'd3-commonjs') return { id: '\0/resolved/d3.js?commonjs-es-import' };
                if (source === 'lib-nullbyte') return { id: '\0/resolved/lib.js' };
                if (source === 'lib-query') return { id: '/resolved/lib.js?commonjs-proxy' };
                return null;
            }),
            warn: vi.fn(),
            addWatchFile: vi.fn(),
        };
    });

    describe('plugin metadata', () => {
        it('should have the correct name', () => {
            expect(plugin.name).toBe('@rollup-extras/plugin-script-loader');
        });

        it('should return a valid plugin object', () => {
            expect(plugin).toHaveProperty('resolveId');
            expect(plugin).toHaveProperty('load');
        });
    });

    describe('resolveId', () => {
        it('should intercept imports with the default "script!" prefix', async () => {
            const result = await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {});
            expect(context.resolve).toHaveBeenCalledWith('d3', '/src/index.js', { skipSelf: true });
            expect(result).toEqual({
                id: '\0script-loader:/resolved/d3.js',
                moduleSideEffects: true,
            });
        });

        it('should ignore imports without the prefix', async () => {
            const result = await plugin.resolveId.call(context, 'd3', '/src/index.js', {});
            expect(context.resolve).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });

        it('should ignore regular relative imports', async () => {
            const result = await plugin.resolveId.call(context, './app.js', '/src/index.js', {});
            expect(result).toBeNull();
        });

        it('should warn and return null when resolution fails', async () => {
            context.resolve = vi.fn(async () => null);
            const result = await plugin.resolveId.call(context, 'script!nonexistent', '/src/index.js', {});
            expect(context.warn).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
            expect(result).toBeNull();
        });

        it('should resolve relative paths with prefix', async () => {
            const result = await plugin.resolveId.call(context, 'script!./vendor/legacy.js', '/src/index.js', {});
            expect(context.resolve).toHaveBeenCalledWith('./vendor/legacy.js', '/src/index.js', { skipSelf: true });
            expect(result).toEqual({
                id: '\0script-loader:/resolved/legacy.js',
                moduleSideEffects: true,
            });
        });

        it('should pass through existing resolveOptions with skipSelf', async () => {
            await plugin.resolveId.call(context, 'script!d3', '/src/index.js', { isEntry: false, custom: { foo: 1 } });
            expect(context.resolve).toHaveBeenCalledWith('d3', '/src/index.js', {
                isEntry: false,
                custom: { foo: 1 },
                skipSelf: true,
            });
        });
    });

    describe('load', () => {
        it('should load and inline the raw script content', async () => {
            const result = await plugin.load.call(context, '\0script-loader:/resolved/d3.js');
            expect(result).toEqual({
                code: 'window.d3 = {};\nexport {}\n',
                map: null,
                moduleSideEffects: true,
            });
        });

        it('should add the file to watch list', async () => {
            await plugin.load.call(context, '\0script-loader:/resolved/d3.js');
            expect(context.addWatchFile).toHaveBeenCalledWith('/resolved/d3.js');
        });

        it('should ignore non-prefixed ids', async () => {
            const result = await plugin.load.call(context, '/some/other/module.js');
            expect(result).toBeNull();
        });

        it('should load different files correctly', async () => {
            const result1 = await plugin.load.call(context, '\0script-loader:/resolved/d3.js');
            const result2 = await plugin.load.call(context, '\0script-loader:/resolved/angular.js');
            expect(result1.code).toContain('window.d3 = {};');
            expect(result2.code).toContain('window.angular = {};');
        });

        it('should append export {} to make it a valid ES module', async () => {
            const result = await plugin.load.call(context, '\0script-loader:/resolved/legacy.js');
            expect(result.code).toBe('var Legacy = true;\nexport {}\n');
        });
    });

    describe('useStrict option', () => {
        it('should append export {} by default (useStrict: true)', async () => {
            const p = scriptLoader();
            const result = await p.load.call(context, '\0script-loader:/resolved/d3.js');
            expect(result.code).toBe('window.d3 = {};\nexport {}\n');
        });

        it('should append export {} when useStrict is explicitly true', async () => {
            const p = scriptLoader({ useStrict: true });
            const result = await p.load.call(context, '\0script-loader:/resolved/d3.js');
            expect(result.code).toBe('window.d3 = {};\nexport {}\n');
        });

        it('should not append export {} when useStrict is false', async () => {
            const p = scriptLoader({ useStrict: false });
            const result = await p.load.call(context, '\0script-loader:/resolved/d3.js');
            expect(result.code).toBe('window.d3 = {};');
        });

        it('should still set moduleSideEffects when useStrict is false', async () => {
            const p = scriptLoader({ useStrict: false });
            const result = await p.load.call(context, '\0script-loader:/resolved/legacy.js');
            expect(result.moduleSideEffects).toBe(true);
        });

        it('should return raw code without trailing newline in sloppy mode', async () => {
            const p = scriptLoader({ useStrict: false });
            const result = await p.load.call(context, '\0script-loader:/resolved/legacy.js');
            expect(result.code).toBe('var Legacy = true;');
            expect(result.code).not.toContain('export');
        });
    });

    describe('custom prefix', () => {
        beforeEach(() => {
            plugin = scriptLoader({ prefix: 'script-loader!' });
        });

        it('should intercept imports with custom prefix', async () => {
            const result = await plugin.resolveId.call(context, 'script-loader!d3', '/src/index.js', {});
            expect(result).toEqual({
                id: '\0script-loader:/resolved/d3.js',
                moduleSideEffects: true,
            });
        });

        it('should not intercept imports with the default prefix', async () => {
            const result = await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {});
            expect(result).toBeNull();
        });
    });

    describe('virtual module marker stripping', () => {
        it('should strip \\0 prefix and ?query suffix from resolved ids', async () => {
            const result = await plugin.resolveId.call(context, 'script!d3-commonjs', '/src/index.js', {});
            expect(result).toEqual({
                id: '\0script-loader:/resolved/d3.js',
                moduleSideEffects: true,
            });
        });

        it('should strip \\0 prefix alone', async () => {
            const result = await plugin.resolveId.call(context, 'script!lib-nullbyte', '/src/index.js', {});
            expect(result).toEqual({
                id: '\0script-loader:/resolved/lib.js',
                moduleSideEffects: true,
            });
        });

        it('should strip ?query suffix alone', async () => {
            const result = await plugin.resolveId.call(context, 'script!lib-query', '/src/index.js', {});
            expect(result).toEqual({
                id: '\0script-loader:/resolved/lib.js',
                moduleSideEffects: true,
            });
        });

        it('should load files resolved from marker-stripped ids', async () => {
            const result = await plugin.resolveId.call(context, 'script!d3-commonjs', '/src/index.js', {});
            const loaded = await plugin.load.call(context, result.id);
            expect(loaded.code).toContain('window.d3 = {};');
        });
    });

    describe('custom plugin name', () => {
        it('should use the provided plugin name', () => {
            const p = scriptLoader({ pluginName: 'my-custom-loader' });
            expect(p.name).toBe('my-custom-loader');
        });
    });

    describe('verbose option', () => {
        it('should create plugin with verbose enabled', () => {
            const p = scriptLoader({ verbose: true });
            expect(p).toHaveProperty('resolveId');
            expect(p).toHaveProperty('load');
        });
    });

    describe('ordering guarantee', () => {
        it('should resolve multiple scripts preserving import order semantics', async () => {
            const ids = [];

            const result1 = await plugin.resolveId.call(context, 'script!d3', '/src/index.js', {});
            ids.push(result1.id);

            const result2 = await plugin.resolveId.call(context, 'script!angular', '/src/index.js', {});
            ids.push(result2.id);

            const result3 = await plugin.resolveId.call(context, 'script!./vendor/legacy.js', '/src/index.js', {});
            ids.push(result3.id);

            // Each gets a unique virtual id
            expect(new Set(ids).size).toBe(3);

            // Load them in order and verify content
            const loaded1 = await plugin.load.call(context, ids[0]);
            const loaded2 = await plugin.load.call(context, ids[1]);
            const loaded3 = await plugin.load.call(context, ids[2]);

            expect(loaded1.code).toContain('d3');
            expect(loaded2.code).toContain('angular');
            expect(loaded3.code).toContain('Legacy');
        });
    });
});
