import { createLogger, LogLevel } from '@niceties/logger';
import path from 'path';
import plugin from '../src';

let log: jest.Mock;

jest.mock('@niceties/logger', () => ({
    createLogger: jest.fn(() => (Object.assign(log = jest.fn(), {
    })))
}));

describe('@rollup-extras/plugin-externals', () => {
    beforeEach(() => {
        jest.resetModules();
        (createLogger as jest.Mock<ReturnType<typeof createLogger>, Parameters<typeof createLogger>>).mockClear();
    });

    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('not external', () => {
        const pluginInstance = plugin();
        const result = (pluginInstance as any).resolveId('test');
        expect(result).toBe(null);
        expect(log).toBeCalledWith('\'test\' is not external', LogLevel.verbose);
    });

    it('external node module', () => {
        const pluginInstance = plugin();
        const result = (pluginInstance as any).resolveId('node_modules/test');
        expect(result).toBe(false);
        expect(log).toBeCalledWith('\'node_modules/test\' is external', LogLevel.verbose);
    });

    it('external linked module', () => {
        const pluginInstance = plugin();
        const result = (pluginInstance as any).resolveId(path.resolve('../../some-module/src/test'));
        expect(result).toBe(false);
    });

    it('internal module', () => {
        const pluginInstance = plugin();
        const result = (pluginInstance as any).resolveId(path.resolve('./test'));
        expect(result).toBe(null);
    });

    it('external built in', () => {
        const pluginInstance = plugin();
        const result = (pluginInstance as any).resolveId('fs');
        expect(result).toBe(false);
        expect(log).toBeCalledWith('\'fs\' is external', LogLevel.verbose);
    });

    it('verbose', () => {
        const pluginInstance = plugin({ verbose: true });
        const result = (pluginInstance as any).resolveId('test');
        expect(result).toBe(null);
        expect(log).toBeCalledWith('\'test\' is not external', LogLevel.info);
    });

    it('custom predicate', () => {
        const external = jest.fn(() => true);
        const pluginInstance = plugin({ external });
        const result = (pluginInstance as any).resolveId('test');
        expect(result).toBe(false);
        expect(log).toBeCalledWith('\'test\' is external', LogLevel.verbose);
        expect(external).toBeCalledWith('test', false);
    });

    it('different plugin name (for debug)', () => {
        plugin({ pluginName: 'test' });
        expect(createLogger).toBeCalledWith('test');
    });
});