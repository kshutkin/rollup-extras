import { describe, expect, it, vi } from 'vitest';

import { multiConfigPluginBase as plugin } from '../src/index.js';

describe('@rollup-extras/util/multi-config-plugin-base', () => {
    it.each(
        [false, true].flatMap(useWriteBundle => [false, true].map(linked => ({ useWriteBundle, linked })))
    )('should wait for concurrent output processing (write: $useWriteBundle, linked: $linked)', async ({ useWriteBundle, linked }) => {
        const processed = [];
        const execute = vi.fn(() => expect(processed).toHaveLength(2));
        const onFinalHook = vi.fn(async (options, bundle) => {
            await bundle.ready;
            processed.push(options);
        });
        const first = plugin(useWriteBundle, 'test', execute, onFinalHook);
        const second = linked ? first.api.addInstance() : first;
        const hook = useWriteBundle ? 'writeBundle' : 'generateBundle';

        for (let round = 0; round < 2; round++) {
            processed.length = 0;
            first.renderStart();
            second.renderStart();
            const releases = [];
            const outputs = [first, second].map((instance, index) => {
                const ready = new Promise(resolve => {
                    releases.push(resolve);
                });
                return instance[hook].call({ index }, index, { ready });
            });
            const early = round % 2;
            try {
                releases[early]();
                await outputs[early];
                expect(execute).toHaveBeenCalledTimes(round);
            } finally {
                releases[1 - early]();
                await Promise.all(outputs);
            }
            expect(execute).toHaveBeenCalledTimes(round + 1);
            expect(execute.mock.contexts[round]).toEqual({ index: 1 - early });
            expect(onFinalHook.mock.calls.slice(round * 2).map(args => args.slice(2))).toEqual([
                [0, 1],
                [0, 0],
            ]);
        }
    });

    it.each([false, true])('should recover after output processing rejects (write: %s)', async useWriteBundle => {
        const execute = vi.fn();
        const onFinalHook = vi.fn().mockRejectedValueOnce(new Error('processing failed')).mockResolvedValue(undefined);
        const instance = plugin(useWriteBundle, 'test', execute, onFinalHook);
        const hook = useWriteBundle ? 'writeBundle' : 'generateBundle';
        instance.renderStart();
        await expect(instance[hook]({}, {})).rejects.toThrow('processing failed');
        expect(execute).not.toHaveBeenCalled();
        instance.renderStart();
        await instance[hook]({}, {});
        expect(execute).toHaveBeenCalledTimes(1);
    });

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
