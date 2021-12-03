import fs from 'fs/promises';
import { createLogger, LogLevel } from '@niceties/logger';
import plugin from '../src';

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
    })

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('happy path', async () => {
        const pluginInstance = plugin();
        await (pluginInstance as any).renderStart({dir: '/dist2'});
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

    it('runOnce by default', async () => {
        const pluginInstance = plugin();
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(fs.rm).toBeCalledTimes(1);
        expect(fs.rm).toBeCalledWith('/dist2', { recursive: true });
    });

    it('runOnce false', async () => {
        const pluginInstance = plugin({runOnce: false});
        await (pluginInstance as any).renderStart({dir: '/dist2'});
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
        expect(loggerStart).toBeCalledWith(`cleaning '/dist2'`, LogLevel.verbose);
        expect(loggerFinish).toBeCalledWith(`cleaned '/dist2'`);
    });

    it('verbose', async () => {
        const pluginInstance = plugin({ verbose: true });
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(loggerStart).toBeCalledWith(`cleaning '/dist2'`, LogLevel.info);
        expect(loggerFinish).toBeCalledWith(`cleaned '/dist2'`);
    });

    it('exception', async () => {
        (fs.rm as jest.Mock<ReturnType<typeof fs.rm>, Parameters<typeof fs.rm>>)
            .mockImplementationOnce(() => { throw { stack: '' }; });
        const pluginInstance = plugin({ verbose: true });
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(loggerFinish).toBeCalledWith(`failed cleaning '/dist2'\n`, LogLevel.warn);
    });

    it('missing directory exception', async () => {
        (fs.rm as jest.Mock<ReturnType<typeof fs.rm>, Parameters<typeof fs.rm>>)
            .mockImplementationOnce(() => { throw { code: 'ENOENT', stack: '' }; });
        const pluginInstance = plugin({ verbose: true });
        await (pluginInstance as any).renderStart({dir: '/dist2'});
        expect(loggerFinish).toBeCalledWith(`failed cleaning '/dist2'\n`, undefined);
    });
});
