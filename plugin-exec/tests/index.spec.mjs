import { describe, expect, it, vi } from 'vitest';

import { createLogger } from '@niceties/logger';

import plugin from '../src';

let loggerFinish, logger;

vi.mock('@niceties/logger', () => ({
    LogLevel: { verbose: 0, info: 1, warn: 2, error: 3 },
    createLogger: vi.fn(() =>
        Object.assign((logger = vi.fn()), {
            finish: (loggerFinish = vi.fn()),
        })
    ),
}));

describe('@rollup-extras/plugin-exec', () => {
    it('smoke', () => {
        expect(plugin).toBeDefined();
    });

    it('pluginName (default)', () => {
        const pluginInstance = plugin(() => undefined);
        expect(pluginInstance.name).toEqual('@rollup-extras/plugin-exec');
        expect(createLogger).toHaveBeenCalledWith('@rollup-extras/plugin-exec');
    });

    it('pluginName (changed)', () => {
        const pluginInstance = plugin({ pluginName: 'test' });
        expect(pluginInstance.name).toEqual('test');
        expect(createLogger).toHaveBeenCalledWith('test');
    });

    it('exec', async () => {
        const exec = vi.fn();
        const pluginInstance = plugin(exec);
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle();
        expect(exec).toHaveBeenCalled();
    });

    it('exec empty', async () => {
        const pluginInstance = plugin(undefined);
        await pluginInstance.renderStart({ dir: 'dist' });
        expect(() => {
            pluginInstance.writeBundle();
        }).not.toThrow();
    });

    it('exec context', async () => {
        const exec = vi.fn(function () {
            this.emitFile({});
            this.logger('test');
        });
        const emitFile = vi.fn();
        const pluginInstance = plugin(exec);
        await pluginInstance.renderStart({ dir: 'dist' });
        await pluginInstance.writeBundle.apply({
            emitFile,
        });
        expect(logger).toHaveBeenCalled();
        expect(emitFile).toHaveBeenCalled();
    });
});
