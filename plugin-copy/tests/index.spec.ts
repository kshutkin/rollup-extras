/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs/promises';
import fs_ from 'fs';
import { glob } from 'glob';
import globParent from 'glob-parent';
import { createLogger, LogLevel } from '@niceties/logger';
import plugin from '../src';
import { PluginContext } from 'rollup';
import path from 'path';

let loggerStart: jest.Mock, loggerFinish: jest.Mock, logger: jest.Mock;

jest.mock('fs/promises');
jest.mock('glob');
jest.mock('glob-parent');
jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => Object.assign((logger = jest.fn()), {
        start: (loggerStart = jest.fn()),
        finish: (loggerFinish = jest.fn())
    }))
}));

describe('@rollup-extras/plugin-copy', () => {

    let rollupContextMock: Partial<PluginContext>;

    beforeEach(() => {
        jest.clearAllMocks();
        rollupContextMock = {
            emitFile: jest.fn(),
            addWatchFile: jest.fn()
        };
        (glob as unknown as jest.Mock<ReturnType<typeof glob>, Parameters<typeof glob>>).mockImplementation(() => Promise.resolve(['assets/aFolder/test.json', 'assets/aFolder/test2.json']));
        (globParent as jest.Mock<ReturnType<typeof globParent>, Parameters<typeof globParent>>).mockImplementation(() => 'assets');
        (fs.readFile as jest.Mock<ReturnType<typeof fs.readFile>, Parameters<typeof fs.readFile>>).mockImplementation(() => Promise.resolve(''));
        (fs.stat as jest.Mock<ReturnType<typeof fs.stat>, Parameters<typeof fs.stat>>).mockImplementation(() => Promise.resolve({
            mtime: new Date(),
            isFile: () => true
        }) as unknown as ReturnType<typeof fs.stat>);
    });

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('pluginName (default)', () => {
        const pluginInstance = plugin('assets/**/*.json');
        expect((pluginInstance as {name: string}).name).toEqual('@rollup-extras/plugin-copy');
    });

    it('pluginName (changed)', () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', pluginName: 'test' });
        expect((pluginInstance as {name: string}).name).toEqual('test');
    });

    it('single string parameter', async () => {
        const pluginInstance = plugin('assets/**/*.json');
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('array of strings as a parameter', async () => {
        const pluginInstance = plugin(['assets/**/*.json']);
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('array of objects as a parameter', async () => {
        const pluginInstance = plugin([{ src: 'assets/**/*.json' }]);
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('object with targets (array of objects) as a parameter', async () => {
        const pluginInstance = plugin({ targets: [{ src: 'assets/**/*.json' }] });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('object with targets (array of strings) as a parameter', async () => {
        const pluginInstance = plugin({ targets: ['assets/**/*.json'] });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('object with targets (string) as a parameter', async () => {
        const pluginInstance = plugin({ targets: 'assets/**/*.json' });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('object without targets as a parameter', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json' });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('object without targets as a parameter but src is array', async () => {
        const pluginInstance = plugin({ src: ['assets/**/*.json'] });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('object without targets as a parameter + dest', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', dest: 'vendor' });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'vendor/aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'vendor/aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('emitOriginalFileName = relative', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitOriginalFileName: 'relative' });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json',
            originalFileName: 'assets/aFolder/test.json',
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json',
            originalFileName: 'assets/aFolder/test2.json',
            source: '',
            type: 'asset'
        }));
    });

    it('emitOriginalFileName = absolute', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitOriginalFileName: 'absolute' });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json',
            originalFileName: path.resolve('assets/aFolder/test.json'),
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json',
            originalFileName: path.resolve('assets/aFolder/test2.json'),
            source: '',
            type: 'asset'
        }));
    });

    it('emitOriginalFileName = function', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitOriginalFileName: (fileName: string) => fileName.replace('assets', 'vendor') });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json', 
            originalFileName: 'vendor/aFolder/test.json',
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json',
            originalFileName: 'vendor/aFolder/test2.json',
            source: '',
            type: 'asset'
        }));
    });

    it('emitOriginalFileName = undefined', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitOriginalFileName: undefined });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json',
            originalFileName: undefined,
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json',
            originalFileName: undefined,
            source: '',
            type: 'asset'
        }));
    });

    it('empty array', async () => {
        const pluginInstance = plugin([]);
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toBeCalledTimes(0);
    });

    it('invalid array', async () => {
        const pluginInstance = plugin([null, '', 123] as string[]);
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toBeCalledTimes(0);
    });

    it('invalid parameter', async () => {
        const pluginInstance = plugin(123 as unknown as string[]);
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toBeCalledTimes(0);
    });

    it('outputPlugin (generateBundle)', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', outputPlugin: true });
        await (pluginInstance as any).generateBundle.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('dest', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', dest: 'folder' });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'folder/aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'folder/aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('exclude', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', dest: 'folder', exclude: 'assets/**' });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(glob).toHaveBeenCalledWith('assets/**/*.json', { ignore: 'assets/**' });
    });

    it('flatten', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', flatten: true });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('dest with slash and flatten', async () => {
        const pluginInstance = plugin({
            targets: [{ src: 'assets/**/*.json', dest: 'folder' }, { src: 'assets/**/*.json', dest: 'folder/' }],
            flatten: true
        });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toBeCalledTimes(2);
    });    

    it('duplicates', async () => {
        const pluginInstance = plugin(['assets/**/*.json', 'assets/**/*.json']);
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toBeCalledTimes(2);
    });

    it('copyOnce (default)', async () => {
        const mtime = new Date();
        (fs.stat as jest.Mock<ReturnType<typeof fs.stat>, Parameters<typeof fs.stat>>).mockImplementation(() => Promise.resolve({
            mtime,
            isFile: () => true,
            isSymbolicLink: () => false
        }) as unknown as ReturnType<typeof fs.stat>);
        const pluginInstance = plugin({ src: 'assets/**/*.json'});
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toBeCalledTimes(2);
    });

    it('copyOnce (false)', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', copyOnce: false});
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toBeCalledTimes(4);
    });

    it('exactFileNames (false)', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', exactFileNames: false });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toHaveBeenCalledWith('assets/aFolder/test.json');
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            name: 'aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            name: 'aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('watch (false)', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', watch: false });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test.json', 
            source: '',
            type: 'asset'
        }));
        expect(rollupContextMock.emitFile).toHaveBeenCalledWith(expect.objectContaining({
            fileName: 'aFolder/test2.json', 
            source: '',
            type: 'asset'
        }));
    });

    it('emitFiles (false)', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitFiles: false });
        await (pluginInstance as any).buildEnd.apply(rollupContextMock);
        expect(rollupContextMock.addWatchFile).toBeCalledTimes(0);
        expect(rollupContextMock.emitFile).toBeCalledTimes(0);
        expect(fs.copyFile).toHaveBeenCalledWith('assets/aFolder/test.json', 'aFolder/test.json', fs_.constants.COPYFILE_FICLONE);
        expect(fs.copyFile).toHaveBeenCalledWith('assets/aFolder/test2.json', 'aFolder/test2.json', fs_.constants.COPYFILE_FICLONE);
    });

    it('non verbose', async () => {
        const pluginInstance = plugin('assets/**/*.json');
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(loggerStart).toHaveBeenCalledWith('copying files', LogLevel.verbose);
        expect(loggerFinish).toHaveBeenCalledWith('copied test.json, test2.json');
    });

    it('verbose', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', verbose: true });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(loggerStart).toHaveBeenCalledWith('copying files', LogLevel.info);
        expect(loggerFinish).toHaveBeenCalledWith('copied test.json, test2.json');
    });

    it('verbose: list-filenames', async () => {
        const pluginInstance = plugin({ src: 'assets/**/*.json', verbose: 'list-filenames' });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(loggerStart).toHaveBeenCalledWith('copying files', LogLevel.info);
        expect(logger).toHaveBeenCalledWith('\tassets/aFolder/test.json → aFolder/test.json', LogLevel.info);
        expect(logger).toHaveBeenCalledWith('\tassets/aFolder/test2.json → aFolder/test2.json', LogLevel.info);
        expect(loggerFinish).toHaveBeenCalledWith('copied 2 files');
    });

    it('readFile exception', async () => {
        (fs.readFile as jest.Mock<ReturnType<typeof fs.readFile>, Parameters<typeof fs.readFile>>)
            .mockImplementationOnce(() => { throw { stack: '' }; });
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitFiles: true });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(logger).toHaveBeenCalledWith('error reading file assets/aFolder/test.json', LogLevel.warn, expect.objectContaining({ stack: '' }));
    });

    it('missing file exception', async () => {
        (fs.readFile as jest.Mock<ReturnType<typeof fs.readFile>, Parameters<typeof fs.readFile>>)
            .mockImplementationOnce(() => { throw { code: 'ENOENT', stack: '' }; });
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitFiles: true });
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(logger).toHaveBeenCalledWith('error reading file assets/aFolder/test.json', undefined, expect.objectContaining({ code: 'ENOENT', stack: '' }));
    });

    it('exception', async () => {
        (fs.copyFile as jest.Mock<ReturnType<typeof fs.copyFile>, Parameters<typeof fs.copyFile>>)
            .mockImplementationOnce(() => { throw { stack: '' }; });
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitFiles: false });
        await (pluginInstance as any).buildEnd.apply(rollupContextMock);
        expect(logger).toHaveBeenCalledWith('error copying file assets/aFolder/test.json → aFolder/test.json', LogLevel.warn, expect.objectContaining({ stack: '' }));
    });

    it('missing directory exception', async () => {
        (fs.copyFile as jest.Mock<ReturnType<typeof fs.copyFile>, Parameters<typeof fs.copyFile>>)
            .mockImplementationOnce(() => { throw { code: 'ENOENT', stack: '' }; });
        const pluginInstance = plugin({ src: 'assets/**/*.json', emitFiles: false });
        await (pluginInstance as any).buildEnd.apply(rollupContextMock);
        expect(logger).toHaveBeenCalledWith('error copying file assets/aFolder/test.json → aFolder/test.json', LogLevel.warn, expect.objectContaining({ code: 'ENOENT', stack: '' }));
    });

    it('statistics', async () => {
        (glob as unknown as jest.Mock<ReturnType<typeof glob>, Parameters<typeof glob>>)
            .mockImplementation(() => Promise.resolve(['1', '2', '3', '4', '5', '6']));
        const pluginInstance = plugin('assets/**/*.json');
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(loggerFinish).toHaveBeenCalledWith('copied 6 files');
    });

    it('something else than file or symlink', async () => {
        (fs.stat as jest.Mock<ReturnType<typeof fs.stat>, Parameters<typeof fs.stat>>).mockImplementation(() => Promise.resolve({
            mtime: new Date(),
            isFile: () => false,
            isSymbolicLink: () => false
        }) as unknown as ReturnType<typeof fs.stat>);

        const pluginInstance = plugin('assets/**/*.json');
        await (pluginInstance as any).buildStart.apply(rollupContextMock);
        expect(rollupContextMock.emitFile).toBeCalledTimes(0);
    });
});
