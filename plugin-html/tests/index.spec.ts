import fs from 'fs/promises';
import oldFs from 'fs';
import { createLogger, LogLevel } from '@niceties/logger';
import { InternalModuleFormat, PluginContext } from 'rollup';
import plugin from '../src';

let loggerStart: jest.Mock, loggerFinish: jest.Mock, logger: jest.Mock;

jest.mock('fs/promises');
jest.mock('fs');
jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => Object.assign((logger =jest.fn()), {
        start: (loggerStart = jest.fn()),
        finish: (loggerFinish = jest.fn())
    }))
}));

describe('@rollup-extras/plugin-html', () => {

    let rollupContextMock: Partial<PluginContext>;

    beforeEach(() => {
        (fs.mkdir as unknown as jest.Mock<ReturnType<typeof fs.mkdir>, Parameters<typeof fs.mkdir>>).mockClear();
        (fs.writeFile as unknown as jest.Mock<ReturnType<typeof fs.writeFile>, Parameters<typeof fs.writeFile>>).mockClear();
        (fs.readFile as unknown as jest.Mock<ReturnType<typeof fs.readFile>, Parameters<typeof fs.writeFile>>)
            .mockClear()
            .mockImplementation(() => Promise.resolve('<!DOCTYPE html><html><head></head><body>File Template</body></html>'));
        (oldFs.readFileSync as unknown as jest.Mock<ReturnType<typeof oldFs.writeFile>, Parameters<typeof fs.writeFile>>)
            .mockClear()
            .mockImplementation(() => '<!DOCTYPE html><html><head></head><body>File Template</body></html>');
        (createLogger as jest.Mock<ReturnType<typeof createLogger>, Parameters<typeof createLogger>>).mockClear();
        rollupContextMock = {
            emitFile: jest.fn(),
            addWatchFile: jest.fn()
        };
    })

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('pluginName (default)', () => {
        const pluginInstance = plugin();
        expect((pluginInstance as {name: string}).name).toEqual('@rollup-extras/plugin-html');
        expect(createLogger).toBeCalledWith('@rollup-extras/plugin-html');
    });

    it('pluginName (changed)', () => {
        const pluginInstance = plugin({ pluginName: 'test' });
        expect((pluginInstance as {name: string}).name).toEqual('test');
        expect(createLogger).toBeCalledWith('test');
    });
    
    it('happy path', async () => {
        const pluginInstance = plugin();

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body><script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('happy path multiple configs', async () => {
        const pluginInstance = plugin();
        const additionalInstance = (pluginInstance as any).api.addInstance();

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);
        (additionalInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (additionalInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {}]);

        expect(additionalInstance.name).toEqual('@rollup-extras/plugin-html#1');

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body><script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('conditinal loding by default (es + iife)', async () => {
        const pluginInstance = plugin();

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.mjs': {
                type: 'chunk',
                isEntry: true
            }
        }]);

        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'iife'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body><script src=\"index.js\" type=\"text/javascript\" nomodule></script><script src=\"index.mjs\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('conditinal loding by default (es + umd)', async () => {
        const pluginInstance = plugin();

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.mjs': {
                type: 'chunk',
                isEntry: true
            }
        }]);

        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'umd'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body><script src=\"index.js\" type=\"text/javascript\" nomodule></script><script src=\"index.mjs\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('conditinal loding by default (es + umd + iife)', async () => {
        const pluginInstance = plugin();

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.mjs': {
                type: 'chunk',
                isEntry: true
            }
        }]);

        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'iife'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            }
        }]);

        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'umd'}, {
            'index.umd.js': {
                type: 'chunk',
                isEntry: true
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body><script src=\"index.js\" type=\"text/javascript\" nomodule></script><script src=\"index.mjs\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('conditinal loding by default (es + iife)', async () => {
        const pluginInstance = plugin({conditionalLoading: false});

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.mjs': {
                type: 'chunk',
                isEntry: true
            }
        }]);

        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'iife'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body><script src=\"index.js\" type=\"text/javascript\"></script><script src=\"index.mjs\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('conditinal loding by default (iife)', async () => {
        const pluginInstance = plugin({conditionalLoading: true});

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);

        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'iife'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body><script src=\"index.js\" type=\"text/javascript\" nomodule></script></body></html>',
            type: 'asset'
        }));
    });

    it('sync assets factory (js)', async () => {
        const assetsFactory = jest.fn(() => '<asset/>');
        const pluginInstance = plugin({ assetsFactory });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.mjs': {
                type: 'chunk',
                isEntry: true,
                code: 'code1'
            }
        }]);

        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'iife'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                code: 'code2'
            }
        }]);

        expect(assetsFactory).toBeCalledWith('index.mjs', 'code1', 'es');
        expect(assetsFactory).toBeCalledWith('index.js', 'code2', 'iife');
        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body><asset/><asset/></body></html>',
            type: 'asset'
        }));
    });

    it('sync assets factory (js amd)', async () => {
        const assetsFactory = jest.fn(() => ({ html: '<asset/>', head: true, type: 'amd' as InternalModuleFormat }));
        const pluginInstance = plugin({ assetsFactory });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'amd'}, {
            'index.mjs': {
                type: 'chunk',
                isEntry: true,
                code: 'code1'
            }
        }]);

        expect(assetsFactory).toBeCalledWith('index.mjs', 'code1', 'amd');
        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body></body></html>',
            type: 'asset'
        }));
    });

    it('async assets factory (js)', async () => {
        const assetsFactory = jest.fn(() => Promise.resolve('<asset/>'));
        const pluginInstance = plugin({ assetsFactory });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.mjs': {
                type: 'chunk',
                isEntry: true,
                code: 'code1'
            }
        }]);

        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'iife'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true,
                code: 'code2'
            }
        }]);
        
        expect(assetsFactory).toBeCalledWith('index.mjs', 'code1', 'es');
        expect(assetsFactory).toBeCalledWith('index.js', 'code2', 'iife');
        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body><asset/><asset/></body></html>',
            type: 'asset'
        }));
    });

    it('sync assets factory (css)', async () => {
        const assetsFactory = jest.fn(() => '<asset/>');
        const pluginInstance = plugin({ assetsFactory });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><asset/></head><body></body></html>',
            type: 'asset'
        }));
    });

    it('sync assets factory (scss)', async () => {
        const assetsFactory = jest.fn(() => ({ html: '<asset/>', head: false, type: 'scss' as InternalModuleFormat }));
        const pluginInstance = plugin({ assetsFactory });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'main.scss': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body></body></html>',
            type: 'asset'
        }));
    });

    it('async assets factory (css)', async () => {
        const assetsFactory = jest.fn(() => Promise.resolve('<asset/>'));
        const pluginInstance = plugin({ assetsFactory });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><asset/></head><body></body></html>',
            type: 'asset'
        }));
    });

    it('ignore (function)', async () => {
        const pluginInstance = plugin({ ignore: (fileName: string) => fileName.endsWith('.css') });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body></body></html>',
            type: 'asset'
        }));
    });

    it('ignore (RegExp)', async () => {
        const pluginInstance = plugin({ ignore: /^.*css$/ });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body></body></html>',
            type: 'asset'
        }));
    });

    it('ignore (boolean)', async () => {
        const pluginInstance = plugin({ ignore: true });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body></body></html>',
            type: 'asset'
        }));
    });

    it('ignore (number)', async () => {
        const pluginInstance = plugin({ ignore: 123 as never as boolean });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body></body></html>',
            type: 'asset'
        }));
        expect(logger).toBeCalledWith('ignore option ignored because it is not a function, RegExp or boolean', LogLevel.warn);
    });

    it('injectIntoHead (function)', async () => {
        const assetsFactory = () => '<asset/>';
        const pluginInstance = plugin({ assetsFactory, injectIntoHead: (fileName: string) => !fileName.endsWith('.css') });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body><asset/></body></html>',
            type: 'asset'
        }));
    });

    it('injectIntoHead (RegExp)', async () => {
        const assetsFactory = () => '<asset/>';
        const pluginInstance = plugin({ assetsFactory, injectIntoHead: /^.*js$/ });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body><asset/></body></html>',
            type: 'asset'
        }));
    });

    it('injectIntoHead (boolean)', async () => {
        const assetsFactory = () => '<asset/>';
        const pluginInstance = plugin({ assetsFactory, injectIntoHead: false });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head></head><body><asset/></body></html>',
            type: 'asset'
        }));
    });

    it('injectIntoHead (number)', async () => {
        const assetsFactory = () => '<asset/>';
        const pluginInstance = plugin({ assetsFactory, injectIntoHead: 123 as never as boolean });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><asset/></head><body></body></html>',
            type: 'asset'
        }));
        expect(logger).toBeCalledWith('injectIntoHead option ignored because it is not a function, RegExp or boolean', LogLevel.warn);
    });

    it('outputFile', async () => {
        const pluginInstance = plugin({ outputFile: 'main.html' });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'main.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body><script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('template', async () => {
        const pluginInstance = plugin({ template: '<html><head>Hi!</head><body>Hello!</body></html>' });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<html><head>Hi!<link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body>Hello!<script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('emitFile: false', async () => {
        const pluginInstance = plugin({ emitFile: false });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(fs.writeFile)
            .toBeCalledWith('index.html', '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body><script src=\"index.js\" type=\"module\"></script></body></html>');
    });

    it('emitFile: auto', async () => {
        const pluginInstance = plugin();

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{dir: 'dest'}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es', dir: 'dest2'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(fs.writeFile)
            .toBeCalledWith('dest/index.html', '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"../dest2/main.css\" type=\"text/css\"></head><body><script src=\"../dest2/index.js\" type=\"module\"></script></body></html>');
        expect(logger)
            .not.toBeCalledWith('cannot emitFile because it is outside of current output.dir, using writeFile instead', LogLevel.verbose);
    });

    it('emitFile: true', async () => {
        const pluginInstance = plugin({ emitFile: true });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{dir: 'dest'}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es', dir: 'dest2'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(fs.writeFile)
            .toBeCalledWith('dest/index.html', '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"../dest2/main.css\" type=\"text/css\"></head><body><script src=\"../dest2/index.js\" type=\"module\"></script></body></html>');
        expect(logger)
            .toBeCalledWith('cannot emitFile because it is outside of current output.dir, using writeFile instead', LogLevel.verbose);
    });

    it('exception in generateBundle', async () => {
        const pluginInstance = plugin();

        (rollupContextMock.emitFile as jest.Mock).mockImplementationOnce(() => { throw new Error('test'); });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(logger).toBeCalledWith('error generating html file', LogLevel.error, expect.any(Error));
        expect(loggerStart).toBeCalledWith('generating html', LogLevel.verbose);
        expect(loggerFinish).toBeCalledWith('html generation failed', LogLevel.error);
    });

    it('happy path with template file', async () => {
        const pluginInstance = plugin({template: 'index.html'});

        await (pluginInstance as any).buildStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);        

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body>File Template<script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('exception with template file', async () => {
        (oldFs.readFileSync as jest.Mock).mockImplementationOnce(() => { throw new Error('test'); });
        plugin({template: 'index.html'});
        expect(logger).toBeCalledWith('error reading template', LogLevel.warn, expect.any(Error));
    });

    it('exception with template file (ENOENT)', async () => {
        (oldFs.readFileSync as jest.Mock).mockImplementationOnce(() => { throw { code: 'ENOENT' }; });
        plugin({template: 'index.html'});
        expect(logger).toBeCalledWith('template nor a file or string', LogLevel.warn, expect.objectContaining({ code: 'ENOENT' }));
    });

    it('exception with template file (null)', async () => {
        (oldFs.readFileSync as jest.Mock).mockImplementationOnce(() => { throw null; });
        plugin({template: 'index.html'});
        expect(logger).toBeCalledWith('error reading template', LogLevel.warn, null);
    });

    it('exception with template file (on reread)', async () => {
        const pluginInstance = plugin({template: 'index.html'});
        (fs.readFile as jest.Mock).mockImplementationOnce(() => { throw new Error('test'); });

        await (pluginInstance as any).buildStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);

        expect(logger).toBeCalledWith('error reading template', LogLevel.warn, expect.any(Error));
    });

    it('exception with template file (on reread, ENOENT)', async () => {
        const pluginInstance = plugin({template: 'index.html'});
        (fs.readFile as jest.Mock).mockImplementationOnce(() => { throw { code: 'ENOENT' }; });

        await (pluginInstance as any).buildStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);

        expect(logger).toBeCalledWith('template nor a file or string', LogLevel.warn, expect.objectContaining({ code: 'ENOENT' }));
    });
    it('exception with template file (on reread, null)', async () => {
        const pluginInstance = plugin({template: 'index.html'});
        (fs.readFile as jest.Mock).mockImplementationOnce(() => { throw null; });

        await (pluginInstance as any).buildStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);

        expect(logger).toBeCalledWith('error reading template', LogLevel.warn, null);
    });

    it('empty template from file', async () => {
        (oldFs.readFileSync as jest.Mock).mockImplementationOnce(() => { return ''; });
        const pluginInstance = plugin({template: 'index.html'});
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body><script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });
    
    it('empty template from file and templateFactory', async () => {
        (oldFs.readFileSync as jest.Mock).mockImplementationOnce(() => { return 'html'; });
        const pluginInstance = plugin({template: 'index.html', templateFactory: (s) => s});
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: 'html',
            type: 'asset'
        }));
    });

    it('empty template from file, watch = false', async () => {
        (fs.readFile as jest.Mock).mockImplementationOnce(() => { return Promise.resolve(''); });
        const pluginInstance = plugin({template: 'index.html', watch: false});
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body><script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });
    
    it('empty template from file and templateFactory, watch = false', async () => {
        (fs.readFile as jest.Mock).mockImplementationOnce(() => { return Promise.resolve('html'); });
        const pluginInstance = plugin({template: 'index.html', templateFactory: (s) => s, watch: false});
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(pluginInstance.buildStart).toBeUndefined();
        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: 'html',
            type: 'asset'
        }));
    });

    it('happy path with template file and watch = false', async () => {
        const pluginInstance = plugin({template: 'index.html', watch: false });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);        

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body>File Template<script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('happy path multiple configs and tempalte file', async () => {
        const pluginInstance = plugin({ template: 'index.html' });
        const additionalInstance = (pluginInstance as any).api.addInstance();

        await (pluginInstance as any).buildStart.apply(rollupContextMock, [{}]);
        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);
        await (pluginInstance as any).buildStart.apply(rollupContextMock, [{}]);
        (additionalInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (additionalInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {}]);

        expect(additionalInstance.name).toEqual('@rollup-extras/plugin-html#1');

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body>File Template<script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('happy path multiple configs and tempalte file ans awtch=false', async () => {
        const pluginInstance = plugin({ template: 'index.html', watch: false });
        const additionalInstance = (pluginInstance as any).api.addInstance();

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);
        (additionalInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (additionalInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {}]);

        expect(pluginInstance.buildStart).toBeUndefined();
        expect(additionalInstance.buildStart).toBeUndefined();

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body>File Template<script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('templateFactory', async () => {
        const templateFactory = jest.fn(() => 'test');
        const pluginInstance = plugin({ template: 'index.html', watch: false, templateFactory });
        const additionalInstance = (pluginInstance as any).api.addInstance();

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);
        (additionalInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (additionalInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {}]);

        expect(templateFactory).toBeCalledWith(
            '<!DOCTYPE html><html><head></head><body>File Template</body></html>',
            expect.objectContaining({
                'asset': [{'head': true, 'html': '<link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\">', 'type': 'asset'}],
                'es': [{'head': false, 'html': expect.any(Function), 'type': 'asset'}],
                'iife': [],
                'umd': []
            }),
            expect.any(Function)
        );
        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: 'test',
            type: 'asset'
        }));
    });

    it('defaultTemplateFactory', async () => {
        const templateFactory = jest.fn((template, assets, fn) => fn(template, assets));
        const pluginInstance = plugin({ template: 'index.html', watch: false, templateFactory });
        const additionalInstance = (pluginInstance as any).api.addInstance();

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);
        (additionalInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (additionalInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {}]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body>File Template<script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('useEmittedTemplate: default', async () => {
        const pluginInstance = plugin();

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.html': {
                type: 'asset',
                source: '<!DOCTYPE html><html><head></head><body>Emitted Template</body></html>'
            },
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body>Emitted Template<script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('useEmittedTemplate: default + template', async () => {
        const pluginInstance = plugin({template: '<!DOCTYPE html><html><head></head><body>Custom Template</body></html>'});

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.html': {
                type: 'asset',
                source: '<!DOCTYPE html><html><head></head><body>Emitted Template</body></html>'
            },
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body>Custom Template<script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('useEmittedTemplate: default (chunk)', async () => {
        const pluginInstance = plugin();

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.html': {
                type: 'chunk',
                code: '<!DOCTYPE html><html><head></head><body>Emitted Template</body></html>'
            },
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body>Emitted Template<script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('useEmittedTemplate: false', async () => {
        const pluginInstance = plugin({useEmittedTemplate: false});

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es'}, {
            'index.html': {
                type: 'asset',
                source: '<!DOCTYPE html><html><head></head><body>Emitted Template</body></html>'
            },
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(rollupContextMock.emitFile).toBeCalledWith(expect.objectContaining({
            fileName: 'index.html',
            source: '<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"main.css\" type=\"text/css\"></head><body><script src=\"index.js\" type=\"module\"></script></body></html>',
            type: 'asset'
        }));
    });

    it('useWriteBundle', () => {
        const pluginInstance = plugin({ useWriteBundle: true });
        expect(pluginInstance.writeBundle).toBeDefined();
    });

    it('verbose', async () => {
        const pluginInstance = plugin({ verbose: true, emitFile: true });

        (pluginInstance as any).renderStart.apply(rollupContextMock, [{dir: 'dest'}]);
        await (pluginInstance as any).generateBundle.apply(rollupContextMock, [{format: 'es', dir: 'dest2'}, {
            'index.js': {
                type: 'chunk',
                isEntry: true
            },
            'main.css': {
                type: 'asset'
            }
        }]);

        expect(logger)
            .toBeCalledWith('cannot emitFile because it is outside of current output.dir, using writeFile instead', LogLevel.info);
    });
});
