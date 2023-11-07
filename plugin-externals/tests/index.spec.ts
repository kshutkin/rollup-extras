import { createLogger, LogLevel } from '@niceties/logger';
import { packageDirectory } from 'pkg-dir';
import plugin from '../src';

let log: jest.Mock;

jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => (Object.assign(log = jest.fn(), {
    })))
}));

jest.mock('pkg-dir', () => ({
    packageDirectory: jest.fn(() => Promise.resolve('')),
    __esModule: true
}));

describe('@rollup-extras/plugin-externals', () => {
    beforeEach(() => {
        jest.resetModules();
        (createLogger as jest.Mock<ReturnType<typeof createLogger>, Parameters<typeof createLogger>>).mockClear();
        (packageDirectory as never as jest.Mock<Promise<string>, []>).mockClear();
    });

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('not external', async () => {
        const pluginInstance = plugin();
        const result = await (pluginInstance as any).resolveId('test');
        expect(result).toBe(null);
        expect(log).toBeCalledWith('\'test\' is not external', LogLevel.verbose);
    });

    it('pkg-dir - underined', async () => {
        (packageDirectory as never as jest.Mock<Promise<string>, []>).mockImplementationOnce(() => Promise.resolve(undefined) as any);
        const pluginInstance = plugin();
        const result = await (pluginInstance as any).resolveId('test');
        expect(result).toBe(null);
        expect(log).toBeCalledWith('\'test\' is not external', LogLevel.verbose);
    });

    it('external node module', async () => {
        const pluginInstance = plugin();
        const result = await (pluginInstance as any).resolveId('node_modules/test');
        expect(result).toBe(false);
        expect(log).toBeCalledWith('\'node_modules/test\' is external', LogLevel.verbose);
    });

    it('external linked module', async () => {
        const pluginInstance = plugin();
        const result = await (pluginInstance as any).resolveId('../../some-module/src/test');
        expect(result).toBe(false);
    });

    it('non external but in different folder', async () => {
        const pluginInstance = plugin();
        const result = await (pluginInstance as any).resolveId('../../test', './src/folder/folder2/test');
        expect(result).toBe(null);
    });

    it('internal module', async () => {
        const pluginInstance = plugin();
        const result = await (pluginInstance as any).resolveId('./test');
        expect(result).toBe(null);
    });

    it('external built in', async () => {
        const pluginInstance = plugin();
        const result = await (pluginInstance as any).resolveId('fs');
        expect(result).toBe(false);
        expect(log).toBeCalledWith('\'fs\' is external', LogLevel.verbose);
    });

    it('verbose', async () => {
        const pluginInstance = plugin({ verbose: true });
        const result = await (pluginInstance as any).resolveId('test');
        expect(result).toBe(null);
        expect(log).toBeCalledWith('\'test\' is not external', LogLevel.info);
    });

    it('custom predicate', async () => {
        const external = jest.fn(() => true);
        const pluginInstance = plugin({ external });
        const result = await (pluginInstance as any).resolveId('test', 'importer');
        expect(result).toBe(false);
        expect(log).toBeCalledWith('\'test\' is external', LogLevel.verbose);
        expect(external).toBeCalledWith('test', false, 'importer');
    });

    it('different plugin name (for debug)', () => {
        plugin({ pluginName: 'test' });
        expect(createLogger).toBeCalledWith('test');
    });
});