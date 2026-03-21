import packageDirectory from 'pkg-dir';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger, LogLevel } from '@niceties/logger';

import plugin from '../src';

let log;

vi.mock('@niceties/logger', () => ({
    LogLevel: { verbose: 0, info: 1, warn: 2, error: 3 },
    createLogger: vi.fn(() => {
        log = vi.fn();
        return Object.assign(log, {});
    }),
}));

vi.mock('pkg-dir', async () => ({
    ...(await vi.importActual('pkg-dir')),
    __esModule: true,
    default: vi.fn(() => Promise.resolve('')),
}));

describe('@rollup-extras/plugin-externals', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.mocked(createLogger).mockClear();
        vi.mocked(packageDirectory).mockClear();
    });

    it('should be defined', () => {
        expect(plugin).toBeDefined();
    });

    it('should return null for non-external module', async () => {
        const pluginInstance = plugin();
        const result = await pluginInstance.resolveId('test');
        expect(result).toBe(null);
        expect(log).toHaveBeenCalledWith("'test' is not external", LogLevel.verbose);
    });

    it('should return null when pkg-dir returns undefined', async () => {
        vi.mocked(packageDirectory).mockImplementationOnce(() => Promise.resolve(undefined));
        const pluginInstance = plugin();
        const result = await pluginInstance.resolveId('test');
        expect(result).toBe(null);
        expect(log).toHaveBeenCalledWith("'test' is not external", LogLevel.verbose);
    });

    it('should mark node_modules path as external', async () => {
        const pluginInstance = plugin();
        const result = await pluginInstance.resolveId('node_modules/test');
        expect(result).toBe(false);
        expect(log).toHaveBeenCalledWith("'node_modules/test' is external", LogLevel.verbose);
    });

    it('should mark linked module as external', async () => {
        const pluginInstance = plugin();
        const result = await pluginInstance.resolveId('../../some-module/src/test');
        expect(result).toBe(false);
    });

    it('should not mark module in different folder as external', async () => {
        const pluginInstance = plugin();
        const result = await pluginInstance.resolveId('../../test', './src/folder/folder2/test');
        expect(result).toBe(null);
    });

    it('should not mark internal module as external', async () => {
        const pluginInstance = plugin();
        const result = await pluginInstance.resolveId('./test');
        expect(result).toBe(null);
    });

    it('should mark built-in module as external', async () => {
        const pluginInstance = plugin();
        const result = await pluginInstance.resolveId('fs');
        expect(result).toBe(false);
        expect(log).toHaveBeenCalledWith("'fs' is external", LogLevel.verbose);
    });

    it('should use info log level when verbose is true', async () => {
        const pluginInstance = plugin({ verbose: true });
        const result = await pluginInstance.resolveId('test');
        expect(result).toBe(null);
        expect(log).toHaveBeenCalledWith("'test' is not external", LogLevel.info);
    });

    it('should use custom external predicate', async () => {
        const external = vi.fn(() => true);
        const pluginInstance = plugin({ external });
        const result = await pluginInstance.resolveId('test', 'importer');
        expect(result).toBe(false);
        expect(log).toHaveBeenCalledWith("'test' is external", LogLevel.verbose);
        expect(external).toHaveBeenCalledWith('test', false, 'importer');
    });

    it('should use different plugin name for debug', () => {
        plugin({ pluginName: 'test' });
        expect(createLogger).toHaveBeenCalledWith('test');
    });
});
