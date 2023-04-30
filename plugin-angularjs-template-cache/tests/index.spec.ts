/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs/promises';
import glob from 'tiny-glob';
import { createLogger, LogLevel } from '@niceties/logger';
import plugin from '../src';
import { PluginContext } from 'rollup';

let loggerStart: jest.Mock, loggerFinish: jest.Mock, logger: jest.Mock;

jest.mock('fs/promises');
jest.mock('tiny-glob');
jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => Object.assign((logger = jest.fn()), {
        start: (loggerStart = jest.fn()),
        finish: (loggerFinish = jest.fn())
    }))
}));

describe('@rollup-extras/plugin-angularjs-template-cache', () => {

    let rollupContextMock: Partial<PluginContext>;

    beforeEach(() => {
        (fs.readFile as unknown as jest.Mock<ReturnType<typeof fs.readFile>, Parameters<typeof fs.readFile>>).mockClear();
        (createLogger as jest.Mock<ReturnType<typeof createLogger>, Parameters<typeof createLogger>>).mockClear();
        rollupContextMock = {
            addWatchFile: jest.fn(),
            emitFile: jest.fn()
        };
        (glob as unknown as jest.Mock<ReturnType<typeof glob>, Parameters<typeof glob>>).mockClear();
        (glob as unknown as jest.Mock<ReturnType<typeof glob>, Parameters<typeof glob>>).mockImplementation(() => Promise.resolve(['aFolder/test.html', 'aFolder/test2.html']));
        (fs.readFile as jest.Mock<ReturnType<typeof fs.readFile>, Parameters<typeof fs.readFile>>).mockClear();
        (fs.readFile as jest.Mock<ReturnType<typeof fs.readFile>, Parameters<typeof fs.readFile>>).mockImplementation(() => Promise.resolve('<html></html>'));
        (fs.stat as jest.Mock<ReturnType<typeof fs.stat>, Parameters<typeof fs.stat>>).mockClear();
        (fs.stat as jest.Mock<ReturnType<typeof fs.stat>, Parameters<typeof fs.stat>>).mockImplementation(() => Promise.resolve({
            mtime: new Date(),
            isFile: () => true
        }) as unknown as ReturnType<typeof fs.stat>);
    });

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    describe('pluginName', () => {
        it('default', () => {
            const pluginInstance = plugin('views/**/*.html');
            expect((pluginInstance as {name: string}).name).toEqual('@rollup-extras/plugin-angularjs-template-cache');
        });

        it('changed', () => {
            const pluginInstance = plugin({ templates: 'views/**/*.html', pluginName: 'test' });
            expect((pluginInstance as {name: string}).name).toEqual('test');
        });
    });

    describe('templates', () => {
        it('no parameters', async () => {
            const pluginInstance = plugin();
            await (pluginInstance as any).buildStart.apply(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test2.html');
            expect(glob).toBeCalledWith('./**/*.html');
        });

        it('custom - string', async () => {
            const pluginInstance = plugin('./views/**/*.html');
            await (pluginInstance as any).buildStart.apply(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test2.html');
            expect(glob).toBeCalledWith('./views/**/*.html');
        });

        it('custom - array', async () => {
            const pluginInstance = plugin(['./views/**/*.html', './**/*.html']);
            await (pluginInstance as any).buildStart.apply(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test2.html');
            expect(glob).toBeCalledWith('./views/**/*.html');
            expect(glob).toBeCalledWith('./**/*.html');
        });

        it('custom templates property - string', async () => {
            const pluginInstance = plugin({templates: './views/**/*.html'});
            await (pluginInstance as any).buildStart.apply(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test2.html');
            expect(glob).toBeCalledWith('./views/**/*.html');
        });

        it('custom templates property - array', async () => {
            const pluginInstance = plugin({templates: ['./views/**/*.html', './**/*.html']});
            await (pluginInstance as any).buildStart.apply(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test2.html');
            expect(glob).toBeCalledWith('./views/**/*.html');
            expect(glob).toBeCalledWith('./**/*.html');
        });

        it('!isFile', async () => {
            (fs.stat as jest.Mock<ReturnType<typeof fs.stat>, Parameters<typeof fs.stat>>).mockImplementation(() => Promise.resolve({
                isFile: () => false
            }) as unknown as ReturnType<typeof fs.stat>);
            const pluginInstance = plugin();
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('$templateCache.put')).toBe(false);
        });
    });

    describe('rootDir', () => {
        it('default', async () => {
            const pluginInstance = plugin();
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('$templateCache.put("aFolder/test.html", "<html></html>");')).toBe(true);
            expect(result.includes('$templateCache.put("aFolder/test2.html", "<html></html>");')).toBe(true);
        });

        it('custom', async () => {
            const pluginInstance = plugin({rootDir: 'aFolder'});
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('$templateCache.put("test.html", "<html></html>");')).toBe(true);
            expect(result.includes('$templateCache.put("test2.html", "<html></html>");')).toBe(true);
        });
        
        it('transformTemplateUri', async () => {
            const transformTemplateUri = jest.fn(() => 'id');
            const pluginInstance = plugin({transformTemplateUri});
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('$templateCache.put("id", "<html></html>");')).toBe(true);
            expect(transformTemplateUri).toBeCalledWith('aFolder/test.html');
            expect(transformTemplateUri).toBeCalledWith('aFolder/test2.html');
        });
    });

    it('processHtml', async () => {
        const processHtml = jest.fn(() => 'some text');
        const pluginInstance = plugin({processHtml});
        await (pluginInstance as any).buildStart.call(rollupContextMock);
        await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
        const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
        expect(result.includes('$templateCache.put("aFolder/test.html", "some text");')).toBe(true);
        expect(result.includes('$templateCache.put("aFolder/test2.html", "some text");')).toBe(true);
        expect(processHtml).toBeCalledWith('<html></html>');
        expect(processHtml).toBeCalledTimes(2);
    });

    describe('angularModule', () => {
        it('default', async () => {
            const pluginInstance = plugin();
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('angular.module("templates", [])')).toBe(true);
        });

        it('standalone', async () => {
            const pluginInstance = plugin({standalone: false});
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('angular.module("templates")')).toBe(true);
        });

        it('custom name', async () => {
            const pluginInstance = plugin({angularModule: 'ngt'});
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('angular.module("ngt", [])')).toBe(true);
        });
    });

    describe('module', () => {
        it('custom name', async () => {
            const pluginInstance = plugin({module: 'ngt'});
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'ngt');
            const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:ngt');
            expect(result.includes('angular.module("templates", [])')).toBe(true);
        });

        it('custom name (negative)', async () => {
            const pluginInstance = plugin({module: 'ngt'});
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(result).toBe(null);
        });
    });

    describe('watch', () => {
        it('default', async () => {
            const pluginInstance = plugin();
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toBeCalledWith('aFolder/test2.html');
        });

        it('off', async () => {
            const pluginInstance = plugin({watch: false});
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).not.toBeCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).not.toBeCalledWith('aFolder/test2.html');
        });
    });

    describe('logger', () => {
        it('less than 5 templates', async () => {
            const pluginInstance = plugin();
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(createLogger).lastCalledWith('@rollup-extras/plugin-angularjs-template-cache');
            expect(loggerStart).lastCalledWith('inlining templates', LogLevel.verbose);
            expect(loggerFinish).toBeCalledWith('inlined aFolder/test.html, aFolder/test2.html');
        });

        it('more than 5 templates', async () => {
            (glob as unknown as jest.Mock<ReturnType<typeof glob>, Parameters<typeof glob>>)
                .mockImplementation(() => Promise.resolve(['1', '2', '3', '4', '5', '6']));
            const pluginInstance = plugin();
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(createLogger).lastCalledWith('@rollup-extras/plugin-angularjs-template-cache');
            expect(loggerStart).lastCalledWith('inlining templates', LogLevel.verbose);
            expect(loggerFinish).toBeCalledWith('inlined 6 templates');
        });

        it('true', async () => {
            const pluginInstance = plugin({verbose: true});
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(loggerStart).lastCalledWith('inlining templates', LogLevel.info);
        });

        it('list-filenames', async () => {
            const pluginInstance = plugin({verbose: 'list-filenames'});
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(logger).toBeCalledWith('\taFolder/test.html → aFolder/test.html', LogLevel.info);
            expect(logger).toBeCalledWith('\taFolder/test2.html → aFolder/test2.html', LogLevel.info);
        });

        it('exception', async () => {
            (fs.readFile as jest.Mock<ReturnType<typeof fs.readFile>, Parameters<typeof fs.readFile>>)
                .mockImplementationOnce(() => { throw { stack: '' }; });
            const pluginInstance = plugin();
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(logger).toBeCalledWith('error reading file aFolder/test.html', LogLevel.warn, expect.objectContaining({ stack: '' }));
        });
    
        it('missing directory exception', async () => {
            (fs.readFile as jest.Mock<ReturnType<typeof fs.readFile>, Parameters<typeof fs.readFile>>)
                .mockImplementationOnce(() => { throw { code: 'ENOENT', stack: '' }; });
            const pluginInstance = plugin();
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(logger).toBeCalledWith('error reading file aFolder/test.html', undefined, expect.objectContaining({ code: 'ENOENT', stack: '' }));
        });
    });

    it('useImports', async () => {
        const pluginInstance = plugin({useImports: true});
        await (pluginInstance as any).buildStart.call(rollupContextMock);
        await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
        const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
        expect(result.includes('import template0 from \'./aFolder/test.html\';')).toBe(true);
        expect(result.includes('$templateCache.put("aFolder/test.html", template0);')).toBe(true);
    });

    it('autoImport - emits entry point', async () => {
        const pluginInstance = plugin({autoImport: true});
        await (pluginInstance as any).buildStart.call(rollupContextMock);
        expect(rollupContextMock.emitFile).toBeCalledWith({id: '\0templates:templates', type: 'chunk'});
        await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
        await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
    });

    it('autoImport: false - delay glob', async () => {
        const pluginInstance = plugin({autoImport: false});
        await (pluginInstance as any).buildStart.call(rollupContextMock);
        expect(glob).not.toBeCalled();
        await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
        await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
        expect(glob).toBeCalled();
    });

    it('autoImport - do not delay glob', async () => {
        const pluginInstance = plugin({autoImport: true});
        await (pluginInstance as any).buildStart.call(rollupContextMock);
        expect(glob).toBeCalled();
        (glob as unknown as jest.Mock<ReturnType<typeof glob>, Parameters<typeof glob>>).mockReset();
        await (pluginInstance as any).resolveId.call(rollupContextMock, '\0templates:templates');
        await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
        expect(glob).not.toBeCalled();
    });

    describe('importAngular', () => {
        it('default', async () => {
            const pluginInstance = plugin();
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('import angular from "angular";')).toBe(true);
        });

        it('default', async () => {
            const pluginInstance = plugin({importAngular: false});
            await (pluginInstance as any).buildStart.call(rollupContextMock);
            await (pluginInstance as any).resolveId.call(rollupContextMock, 'templates');
            const result = await (pluginInstance as any).load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('import angular from "angular";')).toBe(false);
        });
    });
});
