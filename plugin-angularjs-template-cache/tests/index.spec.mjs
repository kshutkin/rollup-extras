import fs from 'fs/promises';

import glob from 'tiny-glob';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger, LogLevel } from '@niceties/logger';

import plugin from '../src';

let loggerStart, loggerFinish, logger;

vi.mock('fs/promises');
vi.mock('tiny-glob');
vi.mock('@niceties/logger', () => ({
    LogLevel: { verbose: 0, info: 1, warn: 2, error: 3 },
    createLogger: vi.fn(() =>
        Object.assign((logger = vi.fn()), {
            start: (loggerStart = vi.fn()),
            finish: (loggerFinish = vi.fn()),
        })
    ),
}));

describe('@rollup-extras/plugin-angularjs-template-cache', () => {
    let rollupContextMock;

    beforeEach(() => {
        vi.mocked(fs.readFile).mockClear();
        vi.mocked(createLogger).mockClear();
        rollupContextMock = {
            addWatchFile: vi.fn(),
            emitFile: vi.fn(),
        };
        vi.mocked(glob).mockClear();
        vi.mocked(glob).mockImplementation(() => Promise.resolve(['aFolder/test.html', 'aFolder/test2.html']));
        vi.mocked(fs.readFile).mockClear();
        vi.mocked(fs.readFile).mockImplementation(() => Promise.resolve('<html></html>'));
        vi.mocked(fs.stat).mockClear();
        vi.mocked(fs.stat).mockImplementation(() =>
            Promise.resolve({
                mtime: new Date(),
                isFile: () => true,
            })
        );
    });

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    describe('pluginName', () => {
        it('default', () => {
            const pluginInstance = plugin('views/**/*.html');
            expect(pluginInstance.name).toEqual('@rollup-extras/plugin-angularjs-template-cache');
        });

        it('changed', () => {
            const pluginInstance = plugin({ templates: 'views/**/*.html', pluginName: 'test' });
            expect(pluginInstance.name).toEqual('test');
        });
    });

    describe('templates', () => {
        it('no parameters', async () => {
            const pluginInstance = plugin();
            await pluginInstance.buildStart.apply(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test2.html');
            expect(glob).toHaveBeenCalledWith('./**/*.html');
        });

        it('custom - string', async () => {
            const pluginInstance = plugin('./views/**/*.html');
            await pluginInstance.buildStart.apply(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test2.html');
            expect(glob).toHaveBeenCalledWith('./views/**/*.html');
        });

        it('custom - array', async () => {
            const pluginInstance = plugin(['./views/**/*.html', './**/*.html']);
            await pluginInstance.buildStart.apply(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test2.html');
            expect(glob).toHaveBeenCalledWith('./views/**/*.html');
            expect(glob).toHaveBeenCalledWith('./**/*.html');
        });

        it('custom templates property - string', async () => {
            const pluginInstance = plugin({ templates: './views/**/*.html' });
            await pluginInstance.buildStart.apply(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test2.html');
            expect(glob).toHaveBeenCalledWith('./views/**/*.html');
        });

        it('custom templates property - array', async () => {
            const pluginInstance = plugin({ templates: ['./views/**/*.html', './**/*.html'] });
            await pluginInstance.buildStart.apply(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test2.html');
            expect(glob).toHaveBeenCalledWith('./views/**/*.html');
            expect(glob).toHaveBeenCalledWith('./**/*.html');
        });

        it('!isFile', async () => {
            vi.mocked(fs.stat).mockImplementation(() =>
                Promise.resolve({
                    isFile: () => false,
                })
            );
            const pluginInstance = plugin();
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('$templateCache.put')).toBe(false);
        });
    });

    describe('rootDir', () => {
        it('default', async () => {
            const pluginInstance = plugin();
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('$templateCache.put("aFolder/test.html", "<html></html>");')).toBe(true);
            expect(result.includes('$templateCache.put("aFolder/test2.html", "<html></html>");')).toBe(true);
        });

        it('custom', async () => {
            const pluginInstance = plugin({ rootDir: 'aFolder' });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('$templateCache.put("test.html", "<html></html>");')).toBe(true);
            expect(result.includes('$templateCache.put("test2.html", "<html></html>");')).toBe(true);
        });

        it('transformTemplateUri', async () => {
            const transformTemplateUri = vi.fn(() => 'id');
            const pluginInstance = plugin({ transformTemplateUri });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('$templateCache.put("id", "<html></html>");')).toBe(true);
            expect(transformTemplateUri).toHaveBeenCalledWith('aFolder/test.html');
            expect(transformTemplateUri).toHaveBeenCalledWith('aFolder/test2.html');
        });
    });

    it('processHtml', async () => {
        const processHtml = vi.fn(() => 'some text');
        const pluginInstance = plugin({ processHtml });
        await pluginInstance.buildStart.call(rollupContextMock);
        await pluginInstance.resolveId.call(rollupContextMock, 'templates');
        const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
        expect(result.includes('$templateCache.put("aFolder/test.html", "some text");')).toBe(true);
        expect(result.includes('$templateCache.put("aFolder/test2.html", "some text");')).toBe(true);
        expect(processHtml).toHaveBeenCalledWith('<html></html>');
        expect(processHtml).toBeCalledTimes(2);
    });

    describe('angularModule', () => {
        it('default', async () => {
            const pluginInstance = plugin();
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('angular.module("templates", [])')).toBe(true);
        });

        it('standalone', async () => {
            const pluginInstance = plugin({ standalone: false });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('angular.module("templates")')).toBe(true);
        });

        it('custom name', async () => {
            const pluginInstance = plugin({ angularModule: 'ngt' });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('angular.module("ngt", [])')).toBe(true);
        });
    });

    describe('module', () => {
        it('custom name', async () => {
            const pluginInstance = plugin({ module: 'ngt' });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'ngt');
            const result = await pluginInstance.load.call(rollupContextMock, '\0templates:ngt');
            expect(result.includes('angular.module("templates", [])')).toBe(true);
        });

        it('custom name (negative)', async () => {
            const pluginInstance = plugin({ module: 'ngt' });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(result).toBe(null);
        });
    });

    describe('watch', () => {
        it('default', async () => {
            const pluginInstance = plugin();
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('aFolder/test2.html');
        });

        it('off', async () => {
            const pluginInstance = plugin({ watch: false });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(rollupContextMock.addWatchFile).not.toHaveBeenCalledWith('aFolder/test.html');
            expect(rollupContextMock.addWatchFile).not.toHaveBeenCalledWith('aFolder/test2.html');
        });
    });

    describe('logger', () => {
        it('less than 5 templates', async () => {
            const pluginInstance = plugin();
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(createLogger).lastCalledWith('@rollup-extras/plugin-angularjs-template-cache');
            expect(loggerStart).lastCalledWith('inlining templates', LogLevel.verbose);
            expect(loggerFinish).toHaveBeenCalledWith('inlined aFolder/test.html, aFolder/test2.html');
        });

        it('more than 5 templates', async () => {
            vi.mocked(glob).mockImplementation(() => Promise.resolve(['1', '2', '3', '4', '5', '6']));
            const pluginInstance = plugin();
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(createLogger).lastCalledWith('@rollup-extras/plugin-angularjs-template-cache');
            expect(loggerStart).lastCalledWith('inlining templates', LogLevel.verbose);
            expect(loggerFinish).toHaveBeenCalledWith('inlined 6 templates');
        });

        it('true', async () => {
            const pluginInstance = plugin({ verbose: true });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(loggerStart).lastCalledWith('inlining templates', LogLevel.info);
        });

        it('list-filenames', async () => {
            const pluginInstance = plugin({ verbose: 'list-filenames' });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(logger).toHaveBeenCalledWith('\taFolder/test.html → aFolder/test.html', LogLevel.info);
            expect(logger).toHaveBeenCalledWith('\taFolder/test2.html → aFolder/test2.html', LogLevel.info);
        });

        it('exception', async () => {
            vi.mocked(fs.readFile).mockImplementationOnce(() => {
                throw { stack: '' };
            });
            const pluginInstance = plugin();
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(logger).toHaveBeenCalledWith(
                'error reading file aFolder/test.html',
                LogLevel.warn,
                expect.objectContaining({ stack: '' })
            );
        });

        it('missing directory exception', async () => {
            vi.mocked(fs.readFile).mockImplementationOnce(() => {
                throw { code: 'ENOENT', stack: '' };
            });
            const pluginInstance = plugin();
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(logger).toHaveBeenCalledWith(
                'error reading file aFolder/test.html',
                undefined,
                expect.objectContaining({ code: 'ENOENT', stack: '' })
            );
        });
    });

    it('useImports', async () => {
        const pluginInstance = plugin({ useImports: true });
        await pluginInstance.buildStart.call(rollupContextMock);
        await pluginInstance.resolveId.call(rollupContextMock, 'templates');
        const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
        expect(result.includes("import template0 from './aFolder/test.html';")).toBe(true);
        expect(result.includes('$templateCache.put("aFolder/test.html", template0);')).toBe(true);
    });

    it('autoImport - emits entry point', async () => {
        const pluginInstance = plugin({ autoImport: true });
        await pluginInstance.buildStart.call(rollupContextMock);
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith({ id: '\0templates:templates', type: 'chunk' });
        await pluginInstance.resolveId.call(rollupContextMock, 'templates');
        await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
    });

    it('autoImport: false - delay glob', async () => {
        const pluginInstance = plugin({ autoImport: false });
        await pluginInstance.buildStart.call(rollupContextMock);
        expect(glob).not.toBeCalled();
        await pluginInstance.resolveId.call(rollupContextMock, 'templates');
        await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
        expect(glob).toBeCalled();
    });

    it('autoImport - do not delay glob', async () => {
        const pluginInstance = plugin({ autoImport: true });
        await pluginInstance.buildStart.call(rollupContextMock);
        expect(glob).toBeCalled();
        vi.mocked(glob).mockReset();
        await pluginInstance.resolveId.call(rollupContextMock, '\0templates:templates');
        await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
        expect(glob).not.toBeCalled();
    });

    describe('importAngular', () => {
        it('default', async () => {
            const pluginInstance = plugin();
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('import angular from "angular";')).toBe(true);
        });

        it('false', async () => {
            const pluginInstance = plugin({ importAngular: false });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const result = await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            expect(result.includes('import angular from "angular";')).toBe(false);
        });
    });

    describe('transformHtmlImportsToUris', () => {
        it('default', async () => {
            const pluginInstance = plugin();
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const resolved = await pluginInstance.resolveId.call(rollupContextMock, './aFolder/test.html');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            const result = await pluginInstance.load.call(rollupContextMock, 'aFolder/test.html');
            expect(resolved).toBe(null);
            expect(result).toBe(null);
        });

        it('true', async () => {
            const pluginInstance = plugin({ transformHtmlImportsToUris: true });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const resolved = await pluginInstance.resolveId.call(rollupContextMock, './aFolder/test.html');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            const result = await pluginInstance.load.call(rollupContextMock, resolved.id);
            expect(resolved).toEqual(expect.objectContaining({ id: '\0template:./aFolder/test.html', moduleSideEffects: false }));
            expect(result).toBe('export default "aFolder/test.html";');
        });

        it('true + importer', async () => {
            const pluginInstance = plugin({ transformHtmlImportsToUris: true });
            await pluginInstance.buildStart.call(rollupContextMock);
            await pluginInstance.resolveId.call(rollupContextMock, 'templates');
            const resolved = await pluginInstance.resolveId.call(rollupContextMock, './aFolder/test.html', 'app/app.js');
            await pluginInstance.load.call(rollupContextMock, '\0templates:templates');
            const result = await pluginInstance.load.call(rollupContextMock, resolved.id);
            expect(resolved).toEqual(expect.objectContaining({ id: '\0template:app/aFolder/test.html', moduleSideEffects: false }));
            expect(result).toBe('export default "app/aFolder/test.html";');
        });
    });
});
