import fs from 'fs/promises';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger, LogLevel } from '@niceties/logger';

import plugin from '../src';

let loggerStart, loggerFinish, loggerUpdate, log;

vi.mock('fs/promises');
vi.mock('@niceties/logger', () => ({
    LogLevel: { verbose: 0, info: 1, warn: 2, error: 3 },
    createLogger: vi.fn(() =>
        Object.assign((log = vi.fn()), {
            start: (loggerStart = vi.fn()),
            finish: (loggerFinish = vi.fn()),
            update: (loggerUpdate = vi.fn()),
        })
    ),
}));

const realPlatform = process.platform;

describe('@rollup-extras/plugin-binify', () => {
    beforeEach(() => {
        vi.resetModules();
        Object.defineProperty(process, 'platform', {
            value: 'linux',
        });
        vi.mocked(fs.chmod).mockClear();
        vi.mocked(createLogger).mockClear();
    });

    afterAll(() => {
        Object.defineProperty(process, 'platform', {
            value: realPlatform,
        });
    });

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('happy path', async () => {
        const pluginInstance = plugin();
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';',
            },
        };
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle(
            {},
            {
                'index.js': chunk,
            }
        );
        await pluginInstance.writeBundle(
            {},
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    fileName: 'index.js',
                },
            }
        );
        expect(fs.chmod).toBeCalledTimes(1);
        expect(fs.chmod).toHaveBeenCalledWith('/dist2/index.js', 0o755);
        expect(loggerStart).toHaveBeenCalledTimes(1);
        expect(loggerStart).toHaveBeenCalledWith(expect.any(String), LogLevel.verbose);
        expect(loggerFinish).toHaveBeenCalledTimes(1);
        expect(loggerUpdate).toHaveBeenCalledTimes(2);
        expect(chunk.map.mappings).toEqual(';;');
        expect(chunk.code).toEqual('#!/usr/bin/env node\nconst test = 1;');
    });

    it('executableFlag: false', async () => {
        const pluginInstance = plugin({ executableFlag: false });
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';',
            },
        };
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle(
            {},
            {
                'index.js': chunk,
            }
        );
        await pluginInstance.writeBundle(
            {},
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    fileName: 'index.js',
                },
            }
        );
        expect(fs.chmod).toBeCalledTimes(0);
        expect(loggerStart).toHaveBeenCalledTimes(1);
        expect(loggerStart).toHaveBeenCalledWith(expect.any(String), LogLevel.verbose);
        expect(loggerFinish).toHaveBeenCalledTimes(1);
        expect(chunk.map.mappings).toEqual(';;');
        expect(chunk.code).toEqual('#!/usr/bin/env node\nconst test = 1;');
    });

    it('win32', async () => {
        Object.defineProperty(process, 'platform', {
            value: 'win32',
        });
        const pluginInstance = plugin();
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';',
            },
        };
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle(
            {},
            {
                'index.js': chunk,
            }
        );
        await pluginInstance.writeBundle(
            {},
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    fileName: 'index.js',
                },
            }
        );
        expect(fs.chmod).toBeCalledTimes(0);
        expect(loggerStart).toHaveBeenCalledTimes(1);
        expect(loggerStart).toHaveBeenCalledWith(expect.any(String), LogLevel.verbose);
        expect(loggerFinish).toHaveBeenCalledTimes(1);
        expect(chunk.map.mappings).toEqual(';;');
        expect(chunk.code).toEqual('#!/usr/bin/env node\nconst test = 1;');
    });

    it('filters out non entry chunks by default', async () => {
        const pluginInstance = plugin();
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';',
            },
        };
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle(
            {},
            {
                'index.js': chunk,
                'test.js': { ...chunk, isEntry: false },
            }
        );
        await pluginInstance.writeBundle(
            {},
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    fileName: 'index.js',
                },
                'test.js': { ...chunk, isEntry: false, fileName: 'test.js' },
            }
        );
        expect(fs.chmod).toBeCalledTimes(1);
        expect(fs.chmod).toHaveBeenCalledWith('/dist2/index.js', 0o755);
    });

    it('filters out assets by default', async () => {
        const pluginInstance = plugin();
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';',
            },
        };
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle(
            {},
            {
                'index.js': chunk,
                'test.js': { ...chunk, type: 'asset' },
            }
        );
        await pluginInstance.writeBundle(
            {},
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    fileName: 'index.js',
                },
                'test.js': { ...chunk, type: 'asset', fileName: 'test.js' },
            }
        );
        expect(fs.chmod).toBeCalledTimes(1);
        expect(fs.chmod).toHaveBeenCalledWith('/dist2/index.js', 0o755);
    });

    it('filter can be applied', async () => {
        const pluginInstance = plugin({ filter: () => true });
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';',
            },
        };
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle(
            {},
            {
                'index.js': chunk,
                'test.js': { ...chunk, type: 'asset', source: '' },
            }
        );
        await pluginInstance.writeBundle(
            {},
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    fileName: 'index.js',
                },
                'test.js': { ...chunk, type: 'asset', fileName: 'test.js' },
            }
        );
        expect(fs.chmod).toBeCalledTimes(2);
    });

    it('verbose: true raises loglevel to info', async () => {
        const pluginInstance = plugin({ verbose: true });
        await pluginInstance.renderStart({ dir: '/dist2' });
        expect(loggerStart).toHaveBeenCalledWith(expect.any(String), LogLevel.info);
    });

    it('no dir in output options', async () => {
        const pluginInstance = plugin({ verbose: true });
        await pluginInstance.renderStart({});
        await pluginInstance.writeBundle(
            {},
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    fileName: 'index.js',
                },
            }
        );
        expect(fs.chmod).toHaveBeenCalledWith('index.js', 0o755);
    });

    it('different plugin name (for debug)', async () => {
        const pluginInstance = plugin({ pluginName: 'test' });
        await pluginInstance.renderStart({});
        expect(createLogger).toHaveBeenCalledWith('test');
    });

    it('shebang can be changed', async () => {
        const pluginInstance = plugin({ shebang: 'test' });
        await pluginInstance.renderStart({});
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';',
            },
        };
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle(
            {},
            {
                'index.js': chunk,
            }
        );
        await pluginInstance.writeBundle(
            {},
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    fileName: 'index.js',
                },
            }
        );
        expect(chunk.code).toEqual('test\nconst test = 1;');
    });

    it('shebang with several lines', async () => {
        const pluginInstance = plugin({ shebang: 'test\n\n' });
        await pluginInstance.renderStart({});
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';',
            },
        };
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle(
            {},
            {
                'index.js': chunk,
            }
        );
        await pluginInstance.writeBundle(
            {},
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    fileName: 'index.js',
                },
            }
        );
        expect(chunk.code).toEqual('test\n\nconst test = 1;');
        expect(chunk.map.mappings).toEqual(';;;');
    });

    it('executableFlag can be changed', async () => {
        const pluginInstance = plugin({ executableFlag: 0 });
        await pluginInstance.renderStart({});
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';',
            },
        };
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle(
            {},
            {
                'index.js': chunk,
            }
        );
        await pluginInstance.writeBundle(
            {},
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    fileName: 'index.js',
                },
            }
        );
        expect(fs.chmod).toHaveBeenCalledWith('/dist2/index.js', 0);
    });

    it('logs error on fs error', async () => {
        const error = 'error';
        vi.mocked(fs.chmod).mockImplementationOnce(() => {
            throw error;
        });
        const pluginInstance = plugin();
        await pluginInstance.renderStart({});
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';',
            },
        };
        await pluginInstance.renderStart({ dir: '/dist2' });
        await pluginInstance.generateBundle(
            {},
            {
                'index.js': chunk,
            }
        );
        await pluginInstance.writeBundle(
            {},
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    fileName: 'index.js',
                },
            }
        );
        expect(log).toHaveBeenCalledWith(expect.any(String), LogLevel.error, error);
    });
});
