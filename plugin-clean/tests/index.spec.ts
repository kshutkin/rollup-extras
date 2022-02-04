import fs from 'fs/promises';
import { createLogger, LogLevel } from '@niceties/logger';
import plugin from '../src';
import { CleanPluginOptions } from '../src/types';

let loggerStart: jest.Mock, loggerFinish: jest.Mock;

jest.mock('fs/promises');
jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => ({
        start: (loggerStart = jest.fn()),
        finish: (loggerFinish = jest.fn())
    }))
}));

describe('@rollup-extras/plugin-clean', () => {

    beforeEach(() => {
        (fs.rm as jest.Mock<ReturnType<typeof fs.rm>, Parameters<typeof fs.rm>>).mockClear();
        (createLogger as jest.Mock<ReturnType<typeof createLogger>, Parameters<typeof createLogger>>).mockClear();
    });

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('happy path', async () => {
        const pluginInstance = plugin();
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toBeCalledWith('/dist2', { recursive: true });
    });

    it('unhappy path', async () => {
        const pluginInstance = plugin(123 as CleanPluginOptions);
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(fs.rm).toBeCalledTimes(1);
    });

    it('with non default directory (string)', async () => {
        const pluginInstance = plugin('/dist2');
        await (pluginInstance as any).renderStart({dir: '/dist3'});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toBeCalledWith('/dist2', { recursive: true });
    });

    it('with non default directory (string[])', async () => {
        const pluginInstance = plugin(['/dist2']);
        await (pluginInstance as any).renderStart({dir: '/dist3'});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toBeCalledWith('/dist2', { recursive: true });
    });

    it('happy path (with targets string)', async () => {
        const pluginInstance = plugin({targets: '/dist2'});
        await (pluginInstance as any).renderStart({});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toBeCalledWith('/dist2', { recursive: true });
    });

    it('happy path (with targets string[])', async () => {
        const pluginInstance = plugin({targets: ['/dist2']});
        await (pluginInstance as any).renderStart({});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toBeCalledWith('/dist2', { recursive: true });
    });

    it('strips ending slash', async () => {
        const pluginInstance = plugin({targets: '/dist2/'});
        await (pluginInstance as any).renderStart({});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toBeCalledWith('/dist2', { recursive: true });
    });

    it('deleteOnce by default', async () => {
        const pluginInstance = plugin();
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toBeCalledWith('/dist2', { recursive: true });
    });

    it('deleteOnce by default (check timings)', async () => {
        (fs.rm as jest.Mock<ReturnType<typeof fs.rm>, Parameters<typeof fs.rm>>)
            .mockImplementation(() => new Promise((resolve) => {
                setTimeout(resolve, 50);
            }));
        const pluginInstance = plugin();
        let rmFinished = false;
        (pluginInstance as any).renderStart({dir: '/dist2'}).then(() => {rmFinished = true;});
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(rmFinished).toBeTruthy();
    });

    it('deleteOnce by default (check timings) + outputPlugin (do not block here)', async () => {
        (fs.rm as jest.Mock<ReturnType<typeof fs.rm>, Parameters<typeof fs.rm>>)
            .mockImplementation(() => new Promise((resolve) => {
                setTimeout(resolve, 50);
            }));
        const pluginInstance = plugin({outputPlugin: false, targets: '/dist2'});
        let rmFinished = false;
        (pluginInstance as any).buildStart({dir: '/dist2'}).then(() => {rmFinished = true;});
        await (pluginInstance as any).buildStart({dir: '/dist2'});
        expect(rmFinished).toBeFalsy();
    });

    it('deleteOnce false', async () => {
        const pluginInstance = plugin({deleteOnce: false});
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        await (pluginInstance as any).generateBundle();
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(fs.rm).toBeCalledTimes(2);
        expect(fs.rm).toBeCalledWith('/dist2', { recursive: true });
    });

    it('pluginName', async () => {
        const pluginName = 'test-plugin';
        const pluginInstance = plugin({pluginName});
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(createLogger).toBeCalledWith(pluginName);
    });

    it('non verbose', async () => {
        const pluginInstance = plugin();
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(loggerStart).toBeCalledWith('cleaning \'/dist2\'', LogLevel.verbose);
        expect(loggerFinish).toBeCalledWith('cleaned \'/dist2\'');
    });

    it('verbose', async () => {
        const pluginInstance = plugin({ verbose: true });
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(loggerStart).toBeCalledWith('cleaning \'/dist2\'', LogLevel.info);
        expect(loggerFinish).toBeCalledWith('cleaned \'/dist2\'');
    });

    it('exception', async () => {
        (fs.rm as jest.Mock<ReturnType<typeof fs.rm>, Parameters<typeof fs.rm>>)
            .mockImplementationOnce(() => { throw { stack: '' }; });
        const pluginInstance = plugin({ verbose: true });
        await (pluginInstance as any).renderStart({dir: 'dist2'});
        expect(loggerFinish).toBeCalledWith('failed cleaning \'dist2\'', LogLevel.warn, expect.objectContaining({ stack: '' }));
    });

    it('missing directory exception', async () => {
        (fs.rm as jest.Mock<ReturnType<typeof fs.rm>, Parameters<typeof fs.rm>>)
            .mockImplementationOnce(() => { throw { code: 'ENOENT', stack: '' }; });
        const pluginInstance = plugin({ verbose: true });
        await (pluginInstance as any).renderStart({dir: 'dist2'});
        expect(loggerFinish).toBeCalledWith('failed cleaning \'dist2\'', undefined, expect.objectContaining({ code: 'ENOENT', stack: '' }));
    });

    it('outputPlugin: false', async () => {
        const pluginInstance = plugin({ targets: 'dist2', outputPlugin: false });
        await (pluginInstance as any).buildStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toBeCalledWith('dist2', { recursive: true });
    });

    it('outputPlugin: false + options without dir', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await (pluginInstance as any).options({});
        await (pluginInstance as any).buildStart();
        expect(fs.rm).toBeCalledTimes(0);
    });

    it('outputPlugin: false + options without dir 2', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await (pluginInstance as any).options({output: {  }});
        await (pluginInstance as any).buildStart();
        expect(fs.rm).toBeCalledTimes(0);
    });

    it('outputPlugin: false + options', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await (pluginInstance as any).options({output: { dir: 'dist2' }});
        await (pluginInstance as any).buildStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toBeCalledWith('dist2', { recursive: true });
    });

    it('outputPlugin: false + options with outputs array', async () => {
        const pluginInstance = plugin({ outputPlugin: false });
        await (pluginInstance as any).options({output: [{ dir: 'dist2' }]});
        await (pluginInstance as any).buildStart();
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toBeCalledWith('dist2', { recursive: true });
    });
});
