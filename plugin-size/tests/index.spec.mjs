import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '@niceties/logger';

import plugin from '../src/index.js';

let loggerMessages, loggerFinish, logger;

vi.mock('@niceties/logger', () => ({
    LogLevel: { verbose: 0, info: 1, warn: 2, error: 3 },
    createLogger: vi.fn(() => {
        loggerMessages = [];
        logger = vi.fn(msg => loggerMessages.push(msg));
        loggerFinish = vi.fn();
        return Object.assign(logger, {
            finish: loggerFinish,
            start: vi.fn(),
        });
    }),
}));

vi.mock('oxc-minify', () => ({
    minify: vi.fn((_fileName, code, _options) =>
        Promise.resolve({
            code: code.replace(/\s+/g, ''),
            map: null,
        })
    ),
}));

vi.mock('@niceties/ansi', () => ({
    bold: vi.fn(s => `<bold>${s}</bold>`),
    dim: vi.fn(s => `<dim>${s}</dim>`),
    green: vi.fn(s => `<green>${s}</green>`),
    red: vi.fn(s => `<red>${s}</red>`),
    cyan: vi.fn(s => `<cyan>${s}</cyan>`),
    yellow: vi.fn(s => `<yellow>${s}</yellow>`),
}));

const fsMock = {
    readFile: vi.fn(() => Promise.reject(new Error('ENOENT'))),
    writeFile: vi.fn(() => Promise.resolve()),
};

vi.mock('node:fs/promises', () => ({
    readFile: (...args) => fsMock.readFile(...args),
    writeFile: (...args) => fsMock.writeFile(...args),
}));

function createMockBundle(items) {
    return items.reduce((bundle, item) => {
        bundle[item.fileName] = item;
        return bundle;
    }, {});
}

function makeEntryChunk(fileName, code) {
    return {
        type: 'chunk',
        fileName,
        code,
        isEntry: true,
        isDynamicEntry: false,
    };
}

function makeChunk(fileName, code) {
    return {
        type: 'chunk',
        fileName,
        code,
        isEntry: false,
        isDynamicEntry: false,
    };
}

function makeAsset(fileName, source) {
    return {
        type: 'asset',
        fileName,
        source,
    };
}

function makeOutputOptions(format = 'es') {
    return { format };
}

/**
 * Simulate the Rollup lifecycle for a single output: renderStart → generateBundle.
 * Both hooks are async in multiConfigPluginBase so we must await them.
 */
async function runOutput(p, format, bundle) {
    await p.renderStart();
    await p.generateBundle(makeOutputOptions(format), bundle);
}

/**
 * Same as runOutput but for multiple plugins / configs.
 * Both share the same internal counters so we call renderStart on all
 * outputs first, then generateBundle on all outputs.
 */
async function runMultiConfigOutputs(configs) {
    // renderStart phase for every output across every config
    for (const { plugin: p, outputs } of configs) {
        for (let i = 0; i < outputs.length; i++) {
            await p.renderStart();
        }
    }
    // generateBundle phase for every output across every config
    for (const { plugin: p, outputs } of configs) {
        for (const { format, bundle } of outputs) {
            await p.generateBundle(makeOutputOptions(format), bundle);
        }
    }
}

describe('@rollup-extras/plugin-size', () => {
    beforeEach(() => {
        fsMock.readFile.mockReset().mockRejectedValue(new Error('ENOENT'));
        fsMock.writeFile.mockReset().mockResolvedValue(undefined);
        loggerMessages = [];
    });

    it('should be defined', () => {
        expect(plugin).toBeDefined();
    });

    it('should return a plugin object', () => {
        const p = plugin();
        expect(p).toBeDefined();
        expect(p.name).toEqual('@rollup-extras/plugin-size');
    });

    it('should use default plugin name', () => {
        const p = plugin();
        expect(p.name).toEqual('@rollup-extras/plugin-size');
        expect(createLogger).toHaveBeenCalledWith('@rollup-extras/plugin-size');
    });

    it('should use custom plugin name', () => {
        const p = plugin({ pluginName: 'test-size' });
        expect(p.name).toEqual('test-size');
        expect(createLogger).toHaveBeenCalledWith('test-size');
    });

    it('should have generateBundle and renderStart methods', () => {
        const p = plugin();
        expect(typeof p.generateBundle).toBe('function');
        expect(typeof p.renderStart).toBe('function');
    });

    it('should expose api.addInstance', () => {
        const p = plugin();
        expect(typeof p.api.addInstance).toBe('function');
    });

    describe('generateBundle lifecycle', () => {
        it('should collect entry chunk stats and report them', async () => {
            const p = plugin();
            const bundle = createMockBundle([makeEntryChunk('index.mjs', 'const x = 1;\n')]);

            await runOutput(p, 'es', bundle);

            expect(loggerMessages.length).toBe(1);
            expect(loggerMessages[0]).toContain('<cyan>es</cyan>');
            expect(loggerMessages[0]).toContain('entry');
            expect(loggerMessages[0]).toContain('gzip');
        });

        it('should collect non-entry chunk stats', async () => {
            const p = plugin();
            const bundle = createMockBundle([makeChunk('chunk-abc123.mjs', 'const y = 2;\n')]);

            await runOutput(p, 'es', bundle);

            expect(loggerMessages.length).toBe(1);
            expect(loggerMessages[0]).toContain('chunks');
            expect(loggerMessages[0]).toContain('<cyan>es</cyan>');
        });

        it('should collect asset stats grouped by extension', async () => {
            const p = plugin();
            const bundle = createMockBundle([makeAsset('styles.css', 'body { color: red; }\n')]);

            await runOutput(p, 'es', bundle);

            expect(loggerMessages.length).toBe(1);
            expect(loggerMessages[0]).toContain('<yellow>.css</yellow>');
            expect(loggerMessages[0]).toContain('assets');
            expect(loggerMessages[0]).toContain('gzip');
        });

        it('should handle binary asset source', async () => {
            const p = plugin();
            const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
            const bundle = createMockBundle([makeAsset('image.png', buf)]);

            await runOutput(p, 'es', bundle);

            expect(loggerMessages.length).toBe(1);
            expect(loggerMessages[0]).toContain('.png');
        });

        it('should accumulate sizes across multiple items of same category and format', async () => {
            const p = plugin();
            const bundle = createMockBundle([makeEntryChunk('a.mjs', 'const a = 1;\n'), makeEntryChunk('b.mjs', 'const b = 2;\n')]);

            await runOutput(p, 'es', bundle);

            const entryLines = loggerMessages.filter(m => m.includes('entry'));
            expect(entryLines).toHaveLength(1);
        });

        it('should handle multiple formats across outputs', async () => {
            const p = plugin();

            const esBundle = createMockBundle([makeEntryChunk('index.mjs', 'export const x = 1;\n')]);
            const cjsBundle = createMockBundle([makeEntryChunk('index.cjs', 'module.exports = { x: 1 };\n')]);

            // renderStart for both outputs first, then generateBundle for both
            await p.renderStart();
            await p.renderStart();
            await p.generateBundle(makeOutputOptions('es'), esBundle);
            await p.generateBundle(makeOutputOptions('cjs'), cjsBundle);

            const entryLines = loggerMessages.filter(m => m.includes('entry'));
            expect(entryLines).toHaveLength(2);
            expect(entryLines.some(l => l.includes('es'))).toBe(true);
            expect(entryLines.some(l => l.includes('cjs'))).toBe(true);
        });

        it('should handle mixed entries, chunks, and assets', async () => {
            const p = plugin();
            const bundle = createMockBundle([
                makeEntryChunk('index.mjs', 'const x = 1;\n'),
                makeChunk('chunk-abc.mjs', 'const y = 2;\n'),
                makeAsset('styles.css', 'body { color: red; }\n'),
            ]);

            await runOutput(p, 'es', bundle);

            expect(loggerMessages.length).toBe(3);
            expect(loggerMessages.some(m => m.includes('entry'))).toBe(true);
            expect(loggerMessages.some(m => m.includes('chunks'))).toBe(true);
            expect(loggerMessages.some(m => m.includes('assets'))).toBe(true);
        });

        it('should not print anything for an empty bundle', async () => {
            const p = plugin();
            await runOutput(p, 'es', {});

            expect(loggerMessages).toHaveLength(0);
        });

        it('should accumulate asset sizes by extension', async () => {
            const p = plugin();
            const bundle = createMockBundle([
                makeAsset('a.css', 'body { color: red; }\n'),
                makeAsset('b.css', 'h1 { font-size: 2em; }\n'),
                makeAsset('icon.svg', '<svg></svg>'),
            ]);

            await runOutput(p, 'es', bundle);

            const cssLines = loggerMessages.filter(m => m.includes('.css'));
            const svgLines = loggerMessages.filter(m => m.includes('.svg'));
            expect(cssLines).toHaveLength(1);
            expect(svgLines).toHaveLength(1);
        });

        it('should use the full file name for assets without an extension', async () => {
            const p = plugin();
            const bundle = createMockBundle([makeAsset('LICENSE', 'MIT License\n')]);

            await runOutput(p, 'es', bundle);

            expect(loggerMessages.length).toBe(1);
            expect(loggerMessages[0]).toContain('<yellow>LICENSE</yellow>');
            expect(loggerMessages[0]).toContain('assets');
        });

        it('should format sizes in kB for chunks larger than 1 kB', async () => {
            const p = plugin();
            // ~2 kB of code — well above 1024 bytes raw
            const code = `const data = "${new Array(2048).fill('x').join('')}";\n`;
            const bundle = createMockBundle([makeEntryChunk('index.mjs', code)]);

            await runOutput(p, 'es', bundle);

            const entryLine = loggerMessages.find(m => m.includes('entry'));
            expect(entryLine).toBeDefined();
            expect(entryLine).toContain('kB');
        });

        it('should format sizes in MB for chunks larger than 1 MB', async () => {
            const p = plugin();
            // ~1.1 MB of code
            const code = `const data = "${new Array(1_100_000).fill('x').join('')}";\n`;
            const bundle = createMockBundle([makeEntryChunk('index.mjs', code)]);

            await runOutput(p, 'es', bundle);

            const entryLine = loggerMessages.find(m => m.includes('entry'));
            expect(entryLine).toBeDefined();
            expect(entryLine).toContain('MB');
        });
    });

    describe('stats file', () => {
        it('should write stats file by default', async () => {
            const p = plugin();
            const bundle = createMockBundle([makeEntryChunk('index.mjs', 'const x = 1;\n')]);

            await runOutput(p, 'es', bundle);

            expect(fsMock.writeFile).toHaveBeenCalledTimes(1);
            const [path, content] = fsMock.writeFile.mock.calls[0];
            expect(path).toContain('.stats.json');
            const parsed = JSON.parse(content);
            expect(parsed.entries).toBeDefined();
            expect(parsed.entries.es).toBeDefined();
            expect(parsed.entries.es.raw).toBeGreaterThan(0);
            expect(parsed.entries.es.minified).toBeGreaterThan(0);
            expect(parsed.entries.es.compressed).toBeGreaterThan(0);
        });

        it('should not write stats file when updateStats is false', async () => {
            const p = plugin({ updateStats: false });
            const bundle = createMockBundle([makeEntryChunk('index.mjs', 'const x = 1;\n')]);

            await runOutput(p, 'es', bundle);

            expect(fsMock.writeFile).not.toHaveBeenCalled();
        });

        it('should use custom stats file path', async () => {
            const p = plugin({ statsFile: 'build/custom-stats.json' });
            const bundle = createMockBundle([makeEntryChunk('index.mjs', 'const x = 1;\n')]);

            await runOutput(p, 'es', bundle);

            expect(fsMock.writeFile).toHaveBeenCalledTimes(1);
            const [path] = fsMock.writeFile.mock.calls[0];
            expect(path).toContain('custom-stats.json');
        });

        it('should load previous stats and show delta', async () => {
            const previousStats = {
                entries: {
                    es: { raw: 100, minified: 50, compressed: 30 },
                },
            };
            fsMock.readFile.mockResolvedValue(JSON.stringify(previousStats));

            const p = plugin();
            const bundle = createMockBundle([makeEntryChunk('index.mjs', 'const x = 1;\n')]);

            await runOutput(p, 'es', bundle);

            expect(loggerMessages.length).toBeGreaterThanOrEqual(1);
            const entryLine = loggerMessages.find(m => m.includes('entry'));
            expect(entryLine).toBeDefined();
            // Delta should be present (either green or red or dim)
            expect(entryLine.includes('<green>') || entryLine.includes('<red>') || entryLine.includes('<dim>')).toBe(true);
        });

        it('should show removed entries from previous stats', async () => {
            const previousStats = {
                entries: {
                    umd: { raw: 500, minified: 300, compressed: 150 },
                },
            };
            fsMock.readFile.mockResolvedValue(JSON.stringify(previousStats));

            const p = plugin();
            const bundle = createMockBundle([makeEntryChunk('index.mjs', 'const x = 1;\n')]);

            await runOutput(p, 'es', bundle);

            const umdLine = loggerMessages.find(m => m.includes('umd'));
            expect(umdLine).toBeDefined();
            expect(umdLine).toContain('removed');
        });

        it('should show removed chunks from previous stats', async () => {
            const previousStats = {
                chunks: {
                    cjs: { raw: 800, minified: 400, compressed: 200 },
                },
            };
            fsMock.readFile.mockResolvedValue(JSON.stringify(previousStats));

            const p = plugin();
            await runOutput(p, 'es', {});

            const cjsLine = loggerMessages.find(m => m.includes('cjs'));
            expect(cjsLine).toBeDefined();
            expect(cjsLine).toContain('removed');
        });

        it('should show removed assets from previous stats', async () => {
            const previousStats = {
                assets: {
                    '.css': { raw: 2000, compressed: 1000 },
                },
            };
            fsMock.readFile.mockResolvedValue(JSON.stringify(previousStats));

            const p = plugin();
            await runOutput(p, 'es', {});

            const cssLine = loggerMessages.find(m => m.includes('.css'));
            expect(cssLine).toBeDefined();
            expect(cssLine).toContain('removed');
        });

        it('should handle invalid JSON in previous stats file gracefully', async () => {
            fsMock.readFile.mockResolvedValue('not json{{{');

            const p = plugin();
            const bundle = createMockBundle([makeEntryChunk('index.mjs', 'const x = 1;\n')]);

            await runOutput(p, 'es', bundle);
            expect(loggerMessages.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle non-existent stats file gracefully', async () => {
            const p = plugin();
            const bundle = createMockBundle([makeEntryChunk('index.mjs', 'const x = 1;\n')]);

            await runOutput(p, 'es', bundle);
        });

        it('should write stats with correct structure for chunks and assets', async () => {
            const p = plugin();
            const bundle = createMockBundle([makeChunk('chunk-abc.mjs', 'const y = 2;\n'), makeAsset('styles.css', 'body{}\n')]);

            await runOutput(p, 'cjs', bundle);

            const [, content] = fsMock.writeFile.mock.calls[0];
            const parsed = JSON.parse(content);
            expect(parsed.chunks).toBeDefined();
            expect(parsed.chunks.cjs).toBeDefined();
            expect(parsed.chunks.cjs.raw).toBeGreaterThan(0);
            expect(parsed.chunks.cjs.minified).toBeGreaterThan(0);
            expect(parsed.chunks.cjs.compressed).toBeGreaterThan(0);
            expect(parsed.assets).toBeDefined();
            expect(parsed.assets['.css']).toBeDefined();
            expect(parsed.assets['.css'].raw).toBeGreaterThan(0);
            expect(parsed.assets['.css'].compressed).toBeGreaterThan(0);
        });
    });

    describe('delta display', () => {
        it('should show green for size decrease', async () => {
            const previousStats = {
                entries: {
                    es: { raw: 99999, minified: 50000, compressed: 30000 },
                },
            };
            fsMock.readFile.mockResolvedValue(JSON.stringify(previousStats));

            const p = plugin();
            const bundle = createMockBundle([makeEntryChunk('index.mjs', 'const x = 1;\n')]);

            await runOutput(p, 'es', bundle);

            const entryLine = loggerMessages.find(m => m.includes('entry'));
            expect(entryLine).toBeDefined();
            expect(entryLine).toContain('<green>');
        });

        it('should show red for size increase', async () => {
            const previousStats = {
                entries: {
                    es: { raw: 1, minified: 1, compressed: 1 },
                },
            };
            fsMock.readFile.mockResolvedValue(JSON.stringify(previousStats));

            const p = plugin();
            const bundle = createMockBundle([makeEntryChunk('index.mjs', 'const x = 1; const y = 2; const z = 3; const w = 4;\n')]);

            await runOutput(p, 'es', bundle);

            const entryLine = loggerMessages.find(m => m.includes('entry'));
            expect(entryLine).toBeDefined();
            expect(entryLine).toContain('<red>');
        });

        it('should show no delta when there is no previous data', async () => {
            const p = plugin();
            const bundle = createMockBundle([makeEntryChunk('index.mjs', 'const x = 1;\n')]);

            await runOutput(p, 'es', bundle);

            const entryLine = loggerMessages.find(m => m.includes('entry'));
            expect(entryLine).toBeDefined();
            expect(entryLine).not.toContain('<green>');
            expect(entryLine).not.toContain('<red>');
            expect(entryLine).not.toContain('<dim>');
        });

        it('should show dim (=) when compressed size is unchanged', async () => {
            // Phase 1: run the plugin to capture the actual compressed size
            const p1 = plugin();
            const code = 'const x = 1;\n';
            const bundle1 = createMockBundle([makeEntryChunk('index.mjs', code)]);

            await runOutput(p1, 'es', bundle1);

            const writtenStats = JSON.parse(fsMock.writeFile.mock.calls[0][1]);

            // Phase 2: feed the exact same stats back as previous, run same input
            fsMock.readFile.mockResolvedValue(JSON.stringify(writtenStats));
            fsMock.writeFile.mockReset().mockResolvedValue(undefined);
            loggerMessages = [];

            const p2 = plugin();
            const bundle2 = createMockBundle([makeEntryChunk('index.mjs', code)]);

            await runOutput(p2, 'es', bundle2);

            const entryLine = loggerMessages.find(m => m.includes('entry'));
            expect(entryLine).toBeDefined();
            expect(entryLine).toContain('<dim>');
            expect(entryLine).toContain('(=)');
        });
    });

    describe('multiple output configs', () => {
        it('should accumulate stats across multiple generateBundle calls', async () => {
            const p = plugin();

            const esEntryBundle = createMockBundle([makeEntryChunk('index.mjs', 'export const a = 1;\n')]);
            const esChunkBundle = createMockBundle([makeChunk('chunk-xyz.mjs', 'export const b = 2;\n')]);
            const cjsBundle = createMockBundle([makeEntryChunk('index.cjs', 'module.exports = {};\n')]);

            // Three outputs: renderStart all, then generateBundle all
            await p.renderStart();
            await p.renderStart();
            await p.renderStart();
            await p.generateBundle(makeOutputOptions('es'), esEntryBundle);
            await p.generateBundle(makeOutputOptions('es'), esChunkBundle);
            await p.generateBundle(makeOutputOptions('cjs'), cjsBundle);

            const esEntryLines = loggerMessages.filter(m => m.includes('es') && m.includes('entry'));
            const esChunkLines = loggerMessages.filter(m => m.includes('es') && m.includes('chunks'));
            const cjsEntryLines = loggerMessages.filter(m => m.includes('cjs') && m.includes('entry'));

            expect(esEntryLines).toHaveLength(1);
            expect(esChunkLines).toHaveLength(1);
            expect(cjsEntryLines).toHaveLength(1);
        });

        it('should only report once after all outputs have been processed', async () => {
            const p = plugin();

            const bundle1 = createMockBundle([makeEntryChunk('index.mjs', 'const a = 1;\n')]);
            const bundle2 = createMockBundle([makeEntryChunk('index.cjs', 'const b = 2;\n')]);

            await p.renderStart();
            await p.renderStart();

            // After first generateBundle the report should not fire yet
            await p.generateBundle(makeOutputOptions('es'), bundle1);
            expect(fsMock.writeFile).not.toHaveBeenCalled();
            expect(loggerMessages).toHaveLength(0);

            // After the last generateBundle the report fires
            await p.generateBundle(makeOutputOptions('cjs'), bundle2);
            expect(fsMock.writeFile).toHaveBeenCalledTimes(1);
            expect(loggerMessages.length).toBeGreaterThan(0);
        });
    });

    describe('api.addInstance', () => {
        it('should return a new plugin instance', () => {
            const p = plugin();
            const instance = p.api.addInstance();
            expect(instance).toBeDefined();
            expect(instance.name).toContain('@rollup-extras/plugin-size');
            expect(typeof instance.renderStart).toBe('function');
            expect(typeof instance.generateBundle).toBe('function');
        });

        it('should share stats across main and added instances', async () => {
            const p = plugin();
            const p2 = p.api.addInstance();

            const esBundle = createMockBundle([makeEntryChunk('index.mjs', 'export const a = 1;\n')]);
            const cjsBundle = createMockBundle([makeEntryChunk('index.cjs', 'module.exports = {};\n')]);

            await runMultiConfigOutputs([
                { plugin: p, outputs: [{ format: 'es', bundle: esBundle }] },
                { plugin: p2, outputs: [{ format: 'cjs', bundle: cjsBundle }] },
            ]);

            const entryLines = loggerMessages.filter(m => m.includes('entry'));
            expect(entryLines).toHaveLength(2);
            expect(entryLines.some(l => l.includes('es'))).toBe(true);
            expect(entryLines.some(l => l.includes('cjs'))).toBe(true);

            // Stats file should be written exactly once
            expect(fsMock.writeFile).toHaveBeenCalledTimes(1);
            const parsed = JSON.parse(fsMock.writeFile.mock.calls[0][1]);
            expect(parsed.entries.es).toBeDefined();
            expect(parsed.entries.cjs).toBeDefined();
        });

        it('should wait for all instances to finish before reporting', async () => {
            const p = plugin();
            const p2 = p.api.addInstance();

            const bundle1 = createMockBundle([makeEntryChunk('index.mjs', 'const a = 1;\n')]);
            const bundle2 = createMockBundle([makeEntryChunk('index.cjs', 'const b = 2;\n')]);

            // renderStart on both configs
            await p.renderStart();
            await p2.renderStart();

            // First config finishes — report should not fire yet
            await p.generateBundle(makeOutputOptions('es'), bundle1);
            expect(fsMock.writeFile).not.toHaveBeenCalled();
            expect(loggerMessages).toHaveLength(0);

            // Second config finishes — now the report fires
            await p2.generateBundle(makeOutputOptions('cjs'), bundle2);
            expect(fsMock.writeFile).toHaveBeenCalledTimes(1);
            expect(loggerMessages.length).toBeGreaterThan(0);
        });

        it('should handle multiple outputs per instance', async () => {
            const p = plugin();
            const p2 = p.api.addInstance();

            const esBundle = createMockBundle([makeEntryChunk('index.mjs', 'export const a = 1;\n')]);
            const cjsBundle = createMockBundle([makeEntryChunk('index.cjs', 'module.exports = {};\n')]);
            const umdBundle = createMockBundle([makeEntryChunk('index.umd.js', 'var x = 1;\n')]);

            // p has two outputs (es + cjs), p2 has one output (umd)
            await runMultiConfigOutputs([
                {
                    plugin: p,
                    outputs: [
                        { format: 'es', bundle: esBundle },
                        { format: 'cjs', bundle: cjsBundle },
                    ],
                },
                { plugin: p2, outputs: [{ format: 'umd', bundle: umdBundle }] },
            ]);

            const entryLines = loggerMessages.filter(m => m.includes('entry'));
            expect(entryLines).toHaveLength(3);
            expect(entryLines.some(l => l.includes('es'))).toBe(true);
            expect(entryLines.some(l => l.includes('cjs'))).toBe(true);
            expect(entryLines.some(l => l.includes('umd'))).toBe(true);
            expect(fsMock.writeFile).toHaveBeenCalledTimes(1);
        });
    });
});
