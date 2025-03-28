import fs from 'fs/promises';
import { createLogger, LogLevel } from '@niceties/logger';
import plugin from '../src';

let loggerStart: jest.Mock, loggerFinish: jest.Mock, loggerUpdate: jest.Mock, log: jest.Mock;

jest.mock('fs/promises');
jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => (Object.assign(log = jest.fn(), {
        start: (loggerStart = jest.fn()),
        finish: (loggerFinish = jest.fn()),
        update: (loggerUpdate = jest.fn())
    })))
}));

const realPlatform = process.platform;

describe('@rollup-extras/plugin-binify', () => {
    beforeEach(() => {
        jest.resetModules();
        Object.defineProperty(process, 'platform', {
            value: 'linux'
        });
        (fs.chmod as jest.Mock<ReturnType<typeof fs.rm>, Parameters<typeof fs.rm>>).mockClear();
        (createLogger as jest.Mock<ReturnType<typeof createLogger>, Parameters<typeof createLogger>>).mockClear();
    });

    afterAll(() => {
        Object.defineProperty(process, 'platform', {
            value: realPlatform
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
                mappings: ';'
            }
        };
        await (pluginInstance as any).renderStart({ dir: '/dist2' });
        await (pluginInstance as any).generateBundle({}, {
            'index.js': chunk
        });
        await (pluginInstance as any).writeBundle({}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                fileName: 'index.js'
            }
        });
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
                mappings: ';'
            }
        };
        await (pluginInstance as any).renderStart({ dir: '/dist2' });
        await (pluginInstance as any).generateBundle({}, {
            'index.js': chunk
        });
        await (pluginInstance as any).writeBundle({}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                fileName: 'index.js'
            }
        });
        expect(fs.chmod).toBeCalledTimes(0);
        expect(loggerStart).toHaveBeenCalledTimes(1);
        expect(loggerStart).toHaveBeenCalledWith(expect.any(String), LogLevel.verbose);
        expect(loggerFinish).toHaveBeenCalledTimes(1);
        expect(chunk.map.mappings).toEqual(';;');
        expect(chunk.code).toEqual('#!/usr/bin/env node\nconst test = 1;');
    });

    it('win32', async () => {
        Object.defineProperty(process, 'platform', {
            value: 'win32'
        });
        const pluginInstance = plugin();
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';'
            }
        };
        await (pluginInstance as any).renderStart({ dir: '/dist2' });
        await (pluginInstance as any).generateBundle({}, {
            'index.js': chunk
        });
        await (pluginInstance as any).writeBundle({}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                fileName: 'index.js'
            }
        });
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
                mappings: ';'
            }
        };
        await (pluginInstance as any).renderStart({ dir: '/dist2' });
        await (pluginInstance as any).generateBundle({}, {
            'index.js': chunk,
            'test.js': { ...chunk, isEntry: false }
        });
        await (pluginInstance as any).writeBundle({}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                fileName: 'index.js'
            },
            'test.js': { ...chunk, isEntry: false, fileName: 'test.js' }
        });
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
                mappings: ';'
            }
        };
        await (pluginInstance as any).renderStart({ dir: '/dist2' });
        await (pluginInstance as any).generateBundle({}, {
            'index.js': chunk,
            'test.js': { ...chunk, type: 'asset' }
        });
        await (pluginInstance as any).writeBundle({}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                fileName: 'index.js'
            },
            'test.js': { ...chunk, type: 'asset', fileName: 'test.js' }
        });
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
                mappings: ';'
            }
        };
        await (pluginInstance as any).renderStart({ dir: '/dist2' });
        await (pluginInstance as any).generateBundle({}, {
            'index.js': chunk,
            'test.js': { ...chunk, type: 'asset', source: '' }
        });
        await (pluginInstance as any).writeBundle({}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                fileName: 'index.js'
            },
            'test.js': { ...chunk, type: 'asset', fileName: 'test.js' }
        });
        expect(fs.chmod).toBeCalledTimes(2);
    });

    it('verbose: true raises loglevel to info', async () => {
        const pluginInstance = plugin({ verbose: true });
        await (pluginInstance as any).renderStart({ dir: '/dist2' });
        expect(loggerStart).toHaveBeenCalledWith(expect.any(String), LogLevel.info);
    });

    it('no dir in output options', async () => {
        const pluginInstance = plugin({ verbose: true });
        await (pluginInstance as any).renderStart({});
        await (pluginInstance as any).writeBundle({}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                fileName: 'index.js'
            }
        });
        expect(fs.chmod).toHaveBeenCalledWith('index.js', 0o755);
    });

    it('different plugin name (for debug)', async () => {
        const pluginInstance = plugin({ pluginName: 'test' });
        await (pluginInstance as any).renderStart({});
        expect(createLogger).toHaveBeenCalledWith('test');
    });

    it('shebang can be changed', async () => {
        const pluginInstance = plugin({ shebang: 'test' });
        await (pluginInstance as any).renderStart({});
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';'
            }
        };
        await (pluginInstance as any).renderStart({ dir: '/dist2' });
        await (pluginInstance as any).generateBundle({}, {
            'index.js': chunk
        });
        await (pluginInstance as any).writeBundle({}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                fileName: 'index.js'
            }
        });
        expect(chunk.code).toEqual('test\nconst test = 1;');
    });
    it('shebang with several lines', async () => {
        const pluginInstance = plugin({ shebang: 'test\n\n' });
        await (pluginInstance as any).renderStart({});
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';'
            }
        };
        await (pluginInstance as any).renderStart({ dir: '/dist2' });
        await (pluginInstance as any).generateBundle({}, {
            'index.js': chunk
        });
        await (pluginInstance as any).writeBundle({}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                fileName: 'index.js'
            }
        });
        expect(chunk.code).toEqual('test\n\nconst test = 1;');
        expect(chunk.map.mappings).toEqual(';;;');
    });
    it('executableFlag can be changed', async () => {
        const pluginInstance = plugin({ executableFlag: 0 });
        await (pluginInstance as any).renderStart({});
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';'
            }
        };
        await (pluginInstance as any).renderStart({ dir: '/dist2' });
        await (pluginInstance as any).generateBundle({}, {
            'index.js': chunk
        });
        await (pluginInstance as any).writeBundle({}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                fileName: 'index.js'
            }
        });
        expect(fs.chmod).toHaveBeenCalledWith('/dist2/index.js', 0);
    });

    it('logs error on fs error', async () => {
        const error = 'error';
        (fs.chmod as jest.Mock<ReturnType<typeof fs.chmod>, Parameters<typeof fs.chmod>>).mockImplementationOnce(() => {
            throw error;
        });
        const pluginInstance = plugin();
        await (pluginInstance as any).renderStart({});
        const chunk = {
            type: 'chunk',
            isEntry: true,
            code: 'const test = 1;',
            map: {
                mappings: ';'
            }
        };
        await (pluginInstance as any).renderStart({ dir: '/dist2' });
        await (pluginInstance as any).generateBundle({}, {
            'index.js': chunk
        });
        await (pluginInstance as any).writeBundle({}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                fileName: 'index.js'
            }
        });
        expect(log).toHaveBeenCalledWith(expect.any(String), LogLevel.error, error);
    });
});