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

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('pluginName (default)', () => {
        const pluginInstance = plugin();
        expect(pluginInstance.name).toEqual('@rollup-extras/plugin-html');
        expect(createLogger).toHaveBeenCalledWith('@rollup-extras/plugin-html');
    });

    it('pluginName (changed)', () => {
        const pluginInstance = plugin({ pluginName: 'test' });
        expect(pluginInstance.name).toEqual('test');
        expect(createLogger).toHaveBeenCalledWith('test');
    });

    it('happy path', async () => {
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

    it('happy path multiple configs', async () => {
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

    it('conditinal loding by default (es + iife)', async () => {
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

    it('conditinal loding by default (es + umd)', async () => {
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

    it('conditinal loding by default (es + umd + iife)', async () => {
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

    it('conditinal loding by default (es + iife) (with false)', async () => {
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

    it('conditinal loding by default (iife)', async () => {
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

    it('sync assets factory (js)', async () => {
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

    it('sync assets factory (js amd)', async () => {
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

    it('async assets factory (js)', async () => {
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

    it('sync assets factory (css)', async () => {
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

    it('sync assets factory (scss)', async () => {
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

    it('async assets factory (css)', async () => {
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

    it('exception in assets factory', async () => {
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

    it('ignore (function)', async () => {
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

    it('ignore (RegExp)', async () => {
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

    it('ignore (boolean)', async () => {
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

    it('ignore (string)', async () => {
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

    it('ignore (number)', async () => {
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

    it('injectIntoHead (function)', async () => {
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

    it('injectIntoHead (RegExp)', async () => {
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

    it('injectIntoHead (boolean)', async () => {
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

    it('injectIntoHead (string)', async () => {
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

    it('injectIntoHead (number)', async () => {
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

    it('outputFile', async () => {
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

    it('template', async () => {
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

    it('emitFile: false', async () => {
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

    it('emitFile: auto', async () => {
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

    it('emitFile: true', async () => {
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

    it('exception in generateBundle', async () => {
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

    it('happy path with template file', async () => {
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

    it('exception with template file', async () => {
        vi.mocked(oldFs.readFileSync).mockImplementationOnce(() => {
            throw new Error('test');
        });
        plugin({ template: 'index.html' });
        expect(logger).toHaveBeenCalledWith('error reading template', LogLevel.warn, expect.any(Error));
    });

    it('exception with template file (ENOENT)', async () => {
        vi.mocked(oldFs.readFileSync).mockImplementationOnce(() => {
            throw { code: 'ENOENT' };
        });
        plugin({ template: 'index.html' });
        expect(logger).toHaveBeenCalledWith('template nor a file or string', LogLevel.warn, expect.objectContaining({ code: 'ENOENT' }));
    });

    it('exception with template file (null)', async () => {
        vi.mocked(oldFs.readFileSync).mockImplementationOnce(() => {
            throw null;
        });
        plugin({ template: 'index.html' });
        expect(logger).toHaveBeenCalledWith('error reading template', LogLevel.warn, null);
    });

    it('exception with template file (on reread)', async () => {
        const pluginInstance = plugin({ template: 'index.html' });
        vi.mocked(fs.readFile).mockImplementationOnce(() => {
            throw new Error('test');
        });

        await pluginInstance.buildStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);

        expect(logger).toHaveBeenCalledWith('error reading template', LogLevel.warn, expect.any(Error));
    });

    it('exception with template file (on reread, ENOENT)', async () => {
        const pluginInstance = plugin({ template: 'index.html' });
        vi.mocked(fs.readFile).mockImplementationOnce(() => {
            throw { code: 'ENOENT' };
        });

        await pluginInstance.buildStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);

        expect(logger).toHaveBeenCalledWith('template nor a file or string', LogLevel.warn, expect.objectContaining({ code: 'ENOENT' }));
    });

    it('exception with template file (on reread, null)', async () => {
        const pluginInstance = plugin({ template: 'index.html' });
        vi.mocked(fs.readFile).mockImplementationOnce(() => {
            throw null;
        });

        await pluginInstance.buildStart.apply(rollupContextMock, [{}]);
        pluginInstance.renderStart.apply(rollupContextMock, [{}]);

        expect(logger).toHaveBeenCalledWith('error reading template', LogLevel.warn, null);
    });

    it('empty template from file', async () => {
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

    it('empty template from file and templateFactory', async () => {
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

    it('empty template from file, watch = false', async () => {
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

    it('empty template from file and templateFactory, watch = false', async () => {
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

    it('happy path with template file and watch = false', async () => {
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

    it('happy path multiple configs and tempalte file', async () => {
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

    it('happy path multiple configs and tempalte file and watch=false', async () => {
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

    it('templateFactory', async () => {
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

    it('defaultTemplateFactory', async () => {
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

    it('useEmittedTemplate: default', async () => {
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

    it('useEmittedTemplate: default + template', async () => {
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

    it('useEmittedTemplate: default (chunk)', async () => {
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

    it('useEmittedTemplate: false', async () => {
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

    it('useWriteBundle', () => {
        const pluginInstance = plugin({ useWriteBundle: true });
        expect(pluginInstance.writeBundle).toBeDefined();
    });

    it('verbose', async () => {
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
