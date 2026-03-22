import fs_ from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger, LogLevel } from '@niceties/logger';

import plugin from '../src';

let loggerStart, loggerFinish, logger;

vi.mock('fs/promises');
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

describe('@rollup-extras/plugin-copy', () => {
    let rollupContextMock;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(createLogger).mockClear();
        rollupContextMock = {
            emitFile: vi.fn(),
            addWatchFile: vi.fn(),
        };
        vi.mocked(fs.glob).mockImplementation(async function* () {
            yield 'assets/aFolder/test.json';
            yield 'assets/aFolder/test2.json';
        });
        vi.mocked(fs.readFile).mockImplementation(() => Promise.resolve(''));
        vi.mocked(fs.stat).mockImplementation(() =>
            Promise.resolve({
                mtime: new Date(),
                isFile: () => true,
            })
        );
    });

    it('should be defined', () => {
        expect(plugin).toBeDefined();
    });

    it('should use default plugin name', () => {
        const pluginInstance = plugin('assets/**/*.json');
        expect(pluginInstance.name).toEqual('@rollup-extras/plugin-copy');
    });

    it('should use changed plugin name', () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', pluginName: 'test' });
        expect(pluginInstance.name).toEqual('test');
    });

    it('should accept single string parameter', async () => {
        const pluginInstance = plugin('assets/**/*.json');
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should accept array of strings as a parameter', async () => {
        const pluginInstance = plugin(['assets/**/*.json']);
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should accept array of objects as a parameter', async () => {
        const pluginInstance = plugin([{ src: 'assets/**/*.json' }]);
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should accept object with targets as array of objects', async () => {
        const pluginInstance = plugin({ targets: [{ src: 'assets/**/*.json' }] });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should accept object with targets as array of strings', async () => {
        const pluginInstance = plugin({ targets: ['assets/**/*.json'] });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should accept object with targets as string', async () => {
        const pluginInstance = plugin({ targets: 'assets/**/*.json' });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should accept object with src property', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json' });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should accept object with src as array', async () => {
        const pluginInstance = plugin({ src: ['assets/**/*.json'] });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should accept object with src and dest properties', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', dest: 'vendor' });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'vendor/aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'vendor/aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should emit relative original file name', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitOriginalFileName: 'relative' });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                originalFileName: 'assets/aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                originalFileName: 'assets/aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should emit absolute original file name', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitOriginalFileName: 'absolute' });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                originalFileName: path.resolve('assets/aFolder/test.json'),
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                originalFileName: path.resolve('assets/aFolder/test2.json'),
                source: '',
                type: 'asset',
            })
        );
    });

    it('should emit original file name from function', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitOriginalFileName: fileName => fileName.replace('assets', 'vendor') });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                originalFileName: 'vendor/aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                originalFileName: 'vendor/aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should not emit original file name when undefined', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitOriginalFileName: undefined });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                originalFileName: undefined,
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                originalFileName: undefined,
                source: '',
                type: 'asset',
            })
        );
    });

    it('should handle empty array parameter', async () => {
        const pluginInstance = plugin([]);
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toBeCalledTimes(0);
    });

    it('should handle invalid array parameter', async () => {
        const pluginInstance = plugin([null, '', 123]);
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toBeCalledTimes(0);
    });

    it('should handle invalid parameter', async () => {
        const pluginInstance = plugin(123);
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toBeCalledTimes(0);
    });

    it('should emit files in generateBundle when outputPlugin is true', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', outputPlugin: true });
        await pluginInstance.generateBundle.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should prepend dest to file names', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', dest: 'folder' });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'folder/aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'folder/aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should pass exclude option to glob', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', dest: 'folder', exclude: 'assets/**' });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(fs.glob).toHaveBeenCalledWith('assets/**/*.json', { exclude: ['assets/**'] });
    });

    it('should pass exclude array option to glob', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', dest: 'folder', exclude: ['assets/aFolder/**', 'assets/bFolder/**'] });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(fs.glob).toHaveBeenCalledWith('assets/**/*.json', { exclude: ['assets/aFolder/**', 'assets/bFolder/**'] });
    });

    it('should flatten file paths when flatten is true', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', flatten: true });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should handle dest with trailing slash and flatten', async () => {
        const pluginInstance = plugin({
            targets: [
                { src: 'assets/**/*.json', dest: 'folder' },
                { src: 'assets/**/*.json', dest: 'folder/' },
            ],
            flatten: true,
        });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toBeCalledTimes(2);
    });

    it('should deduplicate emitted files', async () => {
        const pluginInstance = plugin(['assets/**/*.json', 'assets/**/*.json']);
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toBeCalledTimes(2);
    });

    it('should copy once by default', async () => {
        const mtime = new Date();
        vi.mocked(fs.stat).mockImplementation(() =>
            Promise.resolve({
                mtime,
                isFile: () => true,
                isSymbolicLink: () => false,
            })
        );
        const pluginInstance = plugin({ src: 'assets/**/*.json' });
        await pluginInstance.buildStart.apply(rollupContextMock);
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toBeCalledTimes(2);
    });

    it('should copy every time when copyOnce is false', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', copyOnce: false });
        await pluginInstance.buildStart.apply(rollupContextMock);
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toBeCalledTimes(4);
    });

    it('should use name instead of fileName when exactFileNames is false', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', exactFileNames: false });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should not add watch files when watch is false', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', watch: false });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test.json',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'aFolder/test2.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should copy files directly when emitFiles is false', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitFiles: false });
        await pluginInstance.buildEnd.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toBeCalledTimes(0);
        expect(fs.copyFile).toHaveBeenCalledWith('assets/aFolder/test.json', 'aFolder/test.json', fs_.constants.COPYFILE_FICLONE);
        expect(fs.copyFile).toHaveBeenCalledWith('assets/aFolder/test2.json', 'aFolder/test2.json', fs_.constants.COPYFILE_FICLONE);
    });

    it('should use verbose log level by default', async () => {
        const pluginInstance = plugin('assets/**/*.json');
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(loggerStart).toHaveBeenCalledWith('copying files', LogLevel.verbose);
        expect(loggerFinish).toHaveBeenCalledWith('copied test.json, test2.json');
    });

    it('should use info log level when verbose is true', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', verbose: true });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(loggerStart).toHaveBeenCalledWith('copying files', LogLevel.info);
        expect(loggerFinish).toHaveBeenCalledWith('copied test.json, test2.json');
    });

    it('should list filenames when verbose is list-filenames', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', verbose: 'list-filenames' });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(loggerStart).toHaveBeenCalledWith('copying files', LogLevel.info);
        expect(logger).toHaveBeenCalledWith('\tassets/aFolder/test.json → aFolder/test.json', LogLevel.info);
        expect(logger).toHaveBeenCalledWith('\tassets/aFolder/test2.json → aFolder/test2.json', LogLevel.info);
        expect(loggerFinish).toHaveBeenCalledWith('copied 2 files');
    });

    it('should log warning on readFile exception', async () => {
        vi.mocked(fs.readFile).mockImplementationOnce(() => {
            throw { stack: '' };
        });
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitFiles: true });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(logger).toHaveBeenCalledWith(
            'error reading file assets/aFolder/test.json',
            LogLevel.warn,
            expect.objectContaining({ stack: '' })
        );
    });

    it('should log silently on missing file exception', async () => {
        vi.mocked(fs.readFile).mockImplementationOnce(() => {
            throw { code: 'ENOENT', stack: '' };
        });
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitFiles: true });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(logger).toHaveBeenCalledWith(
            'error reading file assets/aFolder/test.json',
            undefined,
            expect.objectContaining({ code: 'ENOENT', stack: '' })
        );
    });

    it('should log warning on copyFile exception', async () => {
        vi.mocked(fs.copyFile).mockImplementationOnce(() => {
            throw { stack: '' };
        });
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitFiles: false });
        await pluginInstance.buildEnd.apply(rollupContextMock);
        expect(logger).toHaveBeenCalledWith(
            'error copying file assets/aFolder/test.json → aFolder/test.json',
            LogLevel.warn,
            expect.objectContaining({ stack: '' })
        );
    });

    it('should log warning on missing directory exception', async () => {
        vi.mocked(fs.copyFile).mockImplementationOnce(() => {
            throw { code: 'ENOENT', stack: '' };
        });
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitFiles: false });
        await pluginInstance.buildEnd.apply(rollupContextMock);
        expect(logger).toHaveBeenCalledWith(
            'error copying file assets/aFolder/test.json → aFolder/test.json',
            LogLevel.warn,
            expect.objectContaining({ code: 'ENOENT', stack: '' })
        );
    });

    it('should show count when more than 5 files', async () => {
        vi.mocked(fs.glob).mockImplementation(async function* () {
            yield '1';
            yield '2';
            yield '3';
            yield '4';
            yield '5';
            yield '6';
        });
        const pluginInstance = plugin('assets/**/*.json');
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(loggerFinish).toHaveBeenCalledWith('copied 6 files');
    });

    it('should handle glob pattern starting with wildcard', async () => {
        vi.mocked(fs.glob).mockImplementation(async function* () {
            yield 'test.json';
        });
        const pluginInstance = plugin('*.json');
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'test.json',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should skip entries that are not files or symlinks', async () => {
        vi.mocked(fs.stat).mockImplementation(() =>
            Promise.resolve({
                mtime: new Date(),
                isFile: () => false,
                isSymbolicLink: () => false,
            })
        );

        const pluginInstance = plugin('assets/**/*.json');
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toBeCalledTimes(0);
    });

    it('should handle literal file paths (no glob characters)', async () => {
        vi.mocked(fs.glob).mockImplementation(async function* (pattern) {
            yield /** @type {string} */ (pattern);
        });
        const pluginInstance = plugin({ targets: ['src/test.css', 'src/index2.js'], verbose: 'list-filenames' });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'test.css',
                source: '',
                type: 'asset',
            })
        );
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index2.js',
                source: '',
                type: 'asset',
            })
        );
        expect(logger).toHaveBeenCalledWith('\tsrc/test.css → test.css', LogLevel.info);
        expect(logger).toHaveBeenCalledWith('\tsrc/index2.js → index2.js', LogLevel.info);
    });

    it('should handle nested literal file path', async () => {
        vi.mocked(fs.glob).mockImplementation(async function* (pattern) {
            yield /** @type {string} */ (pattern);
        });
        const pluginInstance = plugin('src/test/index.html');
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'index.html',
                source: '',
                type: 'asset',
            })
        );
    });

    it('should handle literal file path with dest', async () => {
        vi.mocked(fs.glob).mockImplementation(async function* (pattern) {
            yield /** @type {string} */ (pattern);
        });
        const pluginInstance = plugin({ src: 'src/test.css', dest: 'vendor' });
        await pluginInstance.buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(
            expect.objectContaining({
                fileName: 'vendor/test.css',
                source: '',
                type: 'asset',
            })
        );
    });
});
