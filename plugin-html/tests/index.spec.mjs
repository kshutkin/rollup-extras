import oldFs from 'node:fs';
import fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger, LogLevel } from '@niceties/logger';

import plugin from '../src';

let loggerStart, loggerFinish, logger;

vi.mock('fs/promises');
vi.mock('fs');
vi.mock('@niceties/logger', () => ({
    LogLevel: { verbose: 0, info: 1, warn: 2, error: 3 },
    createLogger: vi.fn(() => {
        logger = vi.fn();
        loggerStart = vi.fn();
        loggerFinish = vi.fn();
        return Object.assign(logger, {
            start: loggerStart,
            finish: loggerFinish,
        });
    }),
}));

describe('@rollup-extras/plugin-html', () => {
    let rollupContextMock;

    beforeEach(() => {
        vi.mocked(fs.mkdir).mockClear();
        vi.mocked(fs.writeFile).mockClear();
        vi.mocked(fs.readFile)
            .mockClear()
            .mockImplementation(() => Promise.resolve('<!DOCTYPE html><html><head></head><body>File Template</body></html>'));
        vi.mocked(oldFs.readFileSync)
            .mockClear()
            .mockImplementation(() => '<!DOCTYPE html><html><head></head><body>File Template</body></html>');
        vi.mocked(createLogger).mockClear();
        rollupContextMock = {
            emitFile: vi.fn(),
            addWatchFile: vi.fn(),
        };
    });

    it('should be defined', () => {
        expect(plugin).toBeDefined();
    });

    it('should use default plugin name', () => {
        const pluginInstance = plugin();
        expect(pluginInstance.name).toEqual('@rollup-extras/plugin-html');
        expect(createLogger).toHaveBeenCalledWith('@rollup-extras/plugin-html');
    });

    it('should use changed plugin name', () => {
        const pluginInstance = plugin({ pluginName: 'test' });
        expect(pluginInstance.name).toEqual('test');
        expect(createLogger).toHaveBeenCalledWith('test');
    });

    it('should generate HTML with script and stylesheet', async () => {
        const pluginInstance = plugin();

        pluginInstance.renderStart.call(rollupContextMock, {});
        await pluginInstance.generateBundle.call(
            rollupContextMock,
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            }
        );

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body><script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should handle multiple configs', async () => {
        const pluginInstance = plugin();
        const additionalInstance = pluginInstance.api.addInstance();

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);
        additionalInstance.renderStart.apply(rollupContextMock, [{}]);
        await additionalInstance.generateBundle.apply(rollupContextMock, [{ format: 'es' }, {}]);

        expect(additionalInstance.name).toEqual('@rollup-extras/plugin-html#1');

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body><script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use conditional loading by default for es + iife', async () => {
        const pluginInstance = plugin();

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.mjs': {
                    type: 'chunk',
                    isEntry: true,
                },
            },
        ]);

        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'iife' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body><script src="index.js" type="text/javascript" nomodule></script><script src="index.mjs" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use conditional loading by default for es + umd', async () => {
        const pluginInstance = plugin();

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.mjs': {
                    type: 'chunk',
                    isEntry: true,
                },
            },
        ]);

        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'umd' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body><script src="index.js" type="text/javascript" nomodule></script><script src="index.mjs" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use conditional loading by default for es + umd + iife', async () => {
        const pluginInstance = plugin();

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.mjs': {
                    type: 'chunk',
                    isEntry: true,
                },
            },
        ]);

        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'iife' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
            },
        ]);

        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'umd' },
            {
                'index.umd.js': {
                    type: 'chunk',
                    isEntry: true,
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body><script src="index.js" type="text/javascript" nomodule></script><script src="index.mjs" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should not use conditional loading when disabled', async () => {
        const pluginInstance = plugin({ conditionalLoading: false });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.mjs': {
                    type: 'chunk',
                    isEntry: true,
                },
            },
        ]);

        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'iife' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body><script src="index.js" type="text/javascript"></script><script src="index.mjs" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use conditional loading for iife when enabled', async () => {
        const pluginInstance = plugin({ conditionalLoading: true });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);

        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'iife' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body><script src="index.js" type="text/javascript" nomodule></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use sync assets factory for js', async () => {
        const assetsFactory = vi.fn(() => '<asset/>');
        const pluginInstance = plugin({ assetsFactory });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.mjs': {
                    type: 'chunk',
                    isEntry: true,
                    code: 'code1',
                },
            },
        ]);

        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'iife' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    code: 'code2',
                },
            },
        ]);

        expect(assetsFactory).toHaveBeenCalledWith('index.mjs', 'code1', 'es');
        expect(assetsFactory).toHaveBeenCalledWith('index.js', 'code2', 'iife');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body><asset/><asset/></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use sync assets factory for amd', async () => {
        const assetsFactory = vi.fn(() => ({ html: '<asset/>', head: true, type: 'amd' }));
        const pluginInstance = plugin({ assetsFactory });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'amd' },
            {
                'index.mjs': {
                    type: 'chunk',
                    isEntry: true,
                    code: 'code1',
                },
            },
        ]);

        expect(assetsFactory).toHaveBeenCalledWith('index.mjs', 'code1', 'amd');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use async assets factory for js', async () => {
        const assetsFactory = vi.fn(() => Promise.resolve('<asset/>'));
        const pluginInstance = plugin({ assetsFactory });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.mjs': {
                    type: 'chunk',
                    isEntry: true,
                    code: 'code1',
                },
            },
        ]);

        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'iife' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                    code: 'code2',
                },
            },
        ]);

        expect(assetsFactory).toHaveBeenCalledWith('index.mjs', 'code1', 'es');
        expect(assetsFactory).toHaveBeenCalledWith('index.js', 'code2', 'iife');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body><asset/><asset/></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use sync assets factory for css', async () => {
        const assetsFactory = vi.fn(() => '<asset/>');
        const pluginInstance = plugin({ assetsFactory });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><asset/></head><body></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use sync assets factory for scss', async () => {
        const assetsFactory = vi.fn(() => ({ html: '<asset/>', head: false, type: 'scss' }));
        const pluginInstance = plugin({ assetsFactory });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.scss': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use async assets factory for css', async () => {
        const assetsFactory = vi.fn(() => Promise.resolve('<asset/>'));
        const pluginInstance = plugin({ assetsFactory });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><asset/></head><body></body></html>',
                type: 'asset',
            })
        );
    });

    it('should fall back to default on exception in assets factory', async () => {
        const assetsFactory = vi.fn(() => {
            throw new Error('test');
        });
        const pluginInstance = plugin({ assetsFactory });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body></body></html>',
                type: 'asset',
            })
        );
    });

    it('should ignore assets matching function predicate', async () => {
        const pluginInstance = plugin({ ignore: fileName => fileName.endsWith('.css') });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body></body></html>',
                type: 'asset',
            })
        );
    });

    it('should ignore assets matching RegExp', async () => {
        const pluginInstance = plugin({ ignore: /^.*css$/ });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body></body></html>',
                type: 'asset',
            })
        );
    });

    it('should ignore all assets when ignore is true', async () => {
        const pluginInstance = plugin({ ignore: true });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body></body></html>',
                type: 'asset',
            })
        );
    });

    it('should ignore assets matching string extension', async () => {
        const pluginInstance = plugin({ ignore: '.css' });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body></body></html>',
                type: 'asset',
            })
        );
    });

    it('should warn on invalid ignore option', async () => {
        const pluginInstance = plugin({ ignore: 123 });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body></body></html>',
                type: 'asset',
            })
        );
        expect(logger).toHaveBeenCalledWith('ignore option ignored because it is not a function, RegExp, string or boolean', LogLevel.warn);
    });

    it('should inject into head based on function predicate', async () => {
        const assetsFactory = () => '<asset/>';
        const pluginInstance = plugin({ assetsFactory, injectIntoHead: fileName => !fileName.endsWith('.css') });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body><asset/></body></html>',
                type: 'asset',
            })
        );
    });

    it('should inject into head based on RegExp', async () => {
        const assetsFactory = () => '<asset/>';
        const pluginInstance = plugin({ assetsFactory, injectIntoHead: /^.*js$/ });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body><asset/></body></html>',
                type: 'asset',
            })
        );
    });

    it('should inject into body when injectIntoHead is false', async () => {
        const assetsFactory = () => '<asset/>';
        const pluginInstance = plugin({ assetsFactory, injectIntoHead: false });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head></head><body><asset/></body></html>',
                type: 'asset',
            })
        );
    });

    it('should inject into head based on string extension', async () => {
        const assetsFactory = () => '<asset/>';
        const pluginInstance = plugin({ assetsFactory, injectIntoHead: '.css' });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><asset/></head><body></body></html>',
                type: 'asset',
            })
        );
    });

    it('should warn on invalid injectIntoHead option', async () => {
        const assetsFactory = () => '<asset/>';
        const pluginInstance = plugin({ assetsFactory, injectIntoHead: 123 });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><asset/></head><body></body></html>',
                type: 'asset',
            })
        );
        expect(logger).toHaveBeenCalledWith(
            'injectIntoHead option ignored because it is not a function, RegExp, string or boolean',
            LogLevel.warn
        );
    });

    it('should use custom output file name', async () => {
        const pluginInstance = plugin({ outputFile: 'main.html' });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'main.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body><script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use custom template string', async () => {
        const pluginInstance = plugin({ template: '<html><head>Hi!</head><body>Hello!</body></html>' });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<html><head>Hi!<link rel="stylesheet" href="main.css" type="text/css"></head><body>Hello!<script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should write file directly when emitFile is false', async () => {
        const pluginInstance = plugin({ emitFile: false });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(fs.writeFile).toHaveBeenCalledWith(
            'index.html',
            '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body><script src="index.js" type="module"></script></body></html>'
        );
    });

    it('should auto-detect emitFile behavior', async () => {
        const pluginInstance = plugin();

        pluginInstance.renderStart.apply(rollupContextMock, [{ dir: 'dest' }]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es', dir: 'dest2' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(fs.writeFile).toHaveBeenCalledWith(
            'dest/index.html',
            '<!DOCTYPE html><html><head><link rel="stylesheet" href="../dest2/main.css" type="text/css"></head><body><script src="../dest2/index.js" type="module"></script></body></html>'
        );
        expect(logger).not.toHaveBeenCalledWith(
            'cannot emitFile because it is outside of current output.dir, using writeFile instead',
            LogLevel.verbose
        );
    });

    it('should fall back to writeFile when emitFile is true but dir differs', async () => {
        const pluginInstance = plugin({ emitFile: true });

        pluginInstance.renderStart.apply(rollupContextMock, [{ dir: 'dest' }]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es', dir: 'dest2' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(fs.writeFile).toHaveBeenCalledWith(
            'dest/index.html',
            '<!DOCTYPE html><html><head><link rel="stylesheet" href="../dest2/main.css" type="text/css"></head><body><script src="../dest2/index.js" type="module"></script></body></html>'
        );
        expect(logger).toHaveBeenCalledWith(
            'cannot emitFile because it is outside of current output.dir, using writeFile instead',
            LogLevel.verbose
        );
    });

    it('should log error on exception in generateBundle', async () => {
        const pluginInstance = plugin();

        vi.mocked(rollupContextMock.emitFile).mockImplementationOnce(() => {
            throw new Error('test');
        });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(loggerStart).toHaveBeenCalledWith('generating html', LogLevel.verbose);
        expect(loggerFinish).toHaveBeenCalledWith('html generation failed', LogLevel.error, expect.any(Error));
    });

    it('should load template from file', async () => {
        const pluginInstance = plugin({ template: 'index.html' });

        await pluginInstance.buildStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('index.html');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body>File Template<script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should log warning on template file read error', async () => {
        vi.mocked(oldFs.readFileSync).mockImplementationOnce(() => {
            throw new Error('test');
        });
        plugin({ template: 'index.html' });
        expect(logger).toHaveBeenCalledWith('error reading template', LogLevel.warn, expect.any(Error));
    });

    it('should log warning when template file not found', async () => {
        vi.mocked(oldFs.readFileSync).mockImplementationOnce(() => {
            throw { code: 'ENOENT' };
        });
        plugin({ template: 'index.html' });
        expect(logger).toHaveBeenCalledWith(
            'template is neither a file nor a string',
            LogLevel.warn,
            expect.objectContaining({ code: 'ENOENT' })
        );
    });

    it('should log warning on null template file error', async () => {
        vi.mocked(oldFs.readFileSync).mockImplementationOnce(() => {
            throw null;
        });
        plugin({ template: 'index.html' });
        expect(logger).toHaveBeenCalledWith('error reading template', LogLevel.warn, null);
    });

    it('should log warning on template file reread error', async () => {
        const pluginInstance = plugin({ template: 'index.html' });
        vi.mocked(fs.readFile).mockImplementationOnce(() => {
            throw new Error('test');
        });

        await pluginInstance.buildStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);

        expect(logger).toHaveBeenCalledWith('error reading template', LogLevel.warn, expect.any(Error));
    });

    it('should log warning when template file not found on reread', async () => {
        const pluginInstance = plugin({ template: 'index.html' });
        vi.mocked(fs.readFile).mockImplementationOnce(() => {
            throw { code: 'ENOENT' };
        });

        await pluginInstance.buildStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);

        expect(logger).toHaveBeenCalledWith(
            'template is neither a file nor a string',
            LogLevel.warn,
            expect.objectContaining({ code: 'ENOENT' })
        );
    });

    it('should log warning on null template file reread error', async () => {
        const pluginInstance = plugin({ template: 'index.html' });
        vi.mocked(fs.readFile).mockImplementationOnce(() => {
            throw null;
        });

        await pluginInstance.buildStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);

        expect(logger).toHaveBeenCalledWith('error reading template', LogLevel.warn, null);
    });

    it('should use default template when file is empty', async () => {
        vi.mocked(oldFs.readFileSync).mockImplementationOnce(() => {
            return '';
        });
        const pluginInstance = plugin({ template: 'index.html' });
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body><script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use templateFactory with file content', async () => {
        vi.mocked(oldFs.readFileSync).mockImplementationOnce(() => {
            return 'html';
        });
        const pluginInstance = plugin({ template: 'index.html', templateFactory: s => s });
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: 'html',
                type: 'asset',
            })
        );
    });

    it('should use default template when file is empty and watch is false', async () => {
        vi.mocked(fs.readFile).mockImplementationOnce(() => {
            return Promise.resolve('');
        });
        const pluginInstance = plugin({ template: 'index.html', watch: false });
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body><script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use templateFactory with file content and watch false', async () => {
        vi.mocked(fs.readFile).mockImplementationOnce(() => {
            return Promise.resolve('html');
        });
        const pluginInstance = plugin({ template: 'index.html', templateFactory: s => s, watch: false });
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(pluginInstance.buildStart).toBeUndefined();
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: 'html',
                type: 'asset',
            })
        );
    });

    it('should load template from file with watch false', async () => {
        const pluginInstance = plugin({ template: 'index.html', watch: false });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body>File Template<script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should handle multiple configs with template file', async () => {
        const pluginInstance = plugin({ template: 'index.html' });
        const additionalInstance = pluginInstance.api.addInstance();

        await pluginInstance.buildStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);
        await pluginInstance.buildStart.apply(rollupContextMock, [{}]);
        additionalInstance.renderStart.apply(rollupContextMock, [{}]);
        await additionalInstance.generateBundle.apply(rollupContextMock, [{ format: 'es' }, {}]);

        expect(additionalInstance.name).toEqual('@rollup-extras/plugin-html#1');

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body>File Template<script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should handle multiple configs with template file and watch false', async () => {
        const pluginInstance = plugin({ template: 'index.html', watch: false });
        const additionalInstance = pluginInstance.api.addInstance();

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);
        additionalInstance.renderStart.apply(rollupContextMock, [{}]);
        await additionalInstance.generateBundle.apply(rollupContextMock, [{ format: 'es' }, {}]);

        expect(pluginInstance.buildStart).toBeUndefined();
        expect(additionalInstance.buildStart).toBeUndefined();

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body>File Template<script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should call templateFactory with template and assets', async () => {
        const templateFactory = vi.fn(() => 'test');
        const pluginInstance = plugin({ template: 'index.html', watch: false, templateFactory });
        const additionalInstance = pluginInstance.api.addInstance();

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);
        additionalInstance.renderStart.apply(rollupContextMock, [{}]);
        await additionalInstance.generateBundle.apply(rollupContextMock, [{ format: 'es' }, {}]);

        expect(templateFactory).toHaveBeenCalledWith(
            '<!DOCTYPE html><html><head></head><body>File Template</body></html>',
            expect.objectContaining({
                asset: [{ head: true, html: '<link rel="stylesheet" href="main.css" type="text/css">', type: 'asset' }],
                es: [{ head: false, html: expect.any(Function), type: 'asset' }],
                iife: [],
                umd: [],
            }),
            expect.any(Function)
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: 'test',
                type: 'asset',
            })
        );
    });

    it('should use defaultTemplateFactory when passed through', async () => {
        const templateFactory = vi.fn((template, assets, fn) => fn(template, assets));
        const pluginInstance = plugin({ template: 'index.html', watch: false, templateFactory });
        const additionalInstance = pluginInstance.api.addInstance();

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);
        additionalInstance.renderStart.apply(rollupContextMock, [{}]);
        await additionalInstance.generateBundle.apply(rollupContextMock, [{ format: 'es' }, {}]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body>File Template<script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use emitted template by default', async () => {
        const pluginInstance = plugin();

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.html': {
                    type: 'asset',
                    source: '<!DOCTYPE html><html><head></head><body>Emitted Template</body></html>',
                },
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body>Emitted Template<script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should prefer custom template over emitted template', async () => {
        const pluginInstance = plugin({ template: '<!DOCTYPE html><html><head></head><body>Custom Template</body></html>' });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.html': {
                    type: 'asset',
                    source: '<!DOCTYPE html><html><head></head><body>Emitted Template</body></html>',
                },
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body>Custom Template<script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should use emitted template from chunk', async () => {
        const pluginInstance = plugin();

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.html': {
                    type: 'chunk',
                    code: '<!DOCTYPE html><html><head></head><body>Emitted Template</body></html>',
                },
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body>Emitted Template<script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should not use emitted template when disabled', async () => {
        const pluginInstance = plugin({ useEmittedTemplate: false });

        pluginInstance.renderStart.apply(rollupContextMock, [{}]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es' },
            {
                'index.html': {
                    type: 'asset',
                    source: '<!DOCTYPE html><html><head></head><body>Emitted Template</body></html>',
                },
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '<!DOCTYPE html><html><head><link rel="stylesheet" href="main.css" type="text/css"></head><body><script src="index.js" type="module"></script></body></html>',
                type: 'asset',
            })
        );
    });

    it('should define writeBundle when useWriteBundle is true', () => {
        const pluginInstance = plugin({ useWriteBundle: true });
        expect(pluginInstance.writeBundle).toBeDefined();
    });

    it('should use info log level when verbose is true', async () => {
        const pluginInstance = plugin({ verbose: true, emitFile: true });

        pluginInstance.renderStart.apply(rollupContextMock, [{ dir: 'dest' }]);
        await pluginInstance.generateBundle.apply(rollupContextMock, [
            { format: 'es', dir: 'dest2' },
            {
                'index.js': {
                    type: 'chunk',
                    isEntry: true,
                },
                'main.css': {
                    type: 'asset',
                },
            },
        ]);

        expect(logger).toHaveBeenCalledWith(
            'cannot emitFile because it is outside of current output.dir, using writeFile instead',
            LogLevel.verbose
        );
        expect(loggerStart).toHaveBeenCalledWith(expect.any(String), LogLevel.info);
    });
});
