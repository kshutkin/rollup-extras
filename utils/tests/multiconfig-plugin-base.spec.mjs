import { describe, expect, it, vi } from 'vitest';

import { multiConfigPluginBase as plugin } from '../src/index.js';

describe('@rollup-extras/util/multi-config-plugin-base', () => {
    it('should be defined', () => {
        expect(plugin).toBeDefined();
    });

    it('should execute on generateBundle for single instance', async () => {
        const execute = vi.fn();
        const pluginInstance = plugin(false, 'test', execute);
        await pluginInstance.renderStart();
        await pluginInstance.generateBundle(1, 2);
        expect(execute).toBeCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(1, 2);
    });

    it('should execute on generateBundle for additional instance', async () => {
        const execute = vi.fn();
        const pluginInstance = plugin(false, 'test', execute);
        const additionalInstance = pluginInstance.api.addInstance();
        await pluginInstance.renderStart();
        await additionalInstance.renderStart();
        await pluginInstance.generateBundle();
        await additionalInstance.generateBundle(1, 2);
        expect(execute).toBeCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(1, 2);
    });

    it('should execute on writeBundle for single instance', async () => {
        const execute = vi.fn();
        const pluginInstance = plugin(true, 'test', execute);
        await pluginInstance.renderStart();
        await pluginInstance.writeBundle(1, 2);
        expect(execute).toBeCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(1, 2);
    });

    it('should execute on writeBundle for additional instance', async () => {
        const execute = vi.fn();
        const pluginInstance = plugin(true, 'test', execute);
        const additionalInstance = pluginInstance.api.addInstance();
        await pluginInstance.renderStart();
        await additionalInstance.renderStart();
        await pluginInstance.writeBundle();
        await additionalInstance.writeBundle(1, 2);
        expect(execute).toBeCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(1, 2);
    });

    it('should pass exception to rollup', async () => {
        const execute = vi.fn(() => {
            throw new Error('test');
        });
        const pluginInstance = plugin(true, 'test', execute);
        await pluginInstance.renderStart();
        let exception;
        try {
            await pluginInstance.writeBundle(1, 2);
        } catch (e) {
            exception = e;
        }
        expect(exception).toBeDefined();
        expect(execute).toHaveBeenCalledWith(1, 2);
    });

    it('should recover after exception', async () => {
        const execute = vi.fn(() => {
            throw new Error('test');
        });
        const pluginInstance = plugin(true, 'test', execute);
        await pluginInstance.renderStart();
        try {
            await pluginInstance.writeBundle(1, 2);
        } catch (_e) {
            /* suppress */
        }
        await pluginInstance.renderStart();
        try {
            await pluginInstance.writeBundle(1, 2);
        } catch (_e) {
            /* suppress */
        }
        expect(execute).toHaveBeenCalledWith(1, 2);
        expect(execute).toBeCalledTimes(2);
    });

    it('should call onFinalHook callback', async () => {
        const execute = vi.fn(() => {
            throw new Error('test');
        });
        const onFinalHook = vi.fn();
        const pluginInstance = plugin(true, 'test', execute, onFinalHook);
        await pluginInstance.renderStart();
        try {
            await pluginInstance.writeBundle(1, 2);
        } catch (_e) {
            /* suppress */
        }
        await pluginInstance.renderStart();
        try {
            await pluginInstance.writeBundle(1, 2);
        } catch (_e) {
            /* suppress */
        }
        expect(execute).toHaveBeenCalledWith(1, 2);
        expect(execute).toBeCalledTimes(2);
        expect(onFinalHook).toBeCalledTimes(2);
    });
});
