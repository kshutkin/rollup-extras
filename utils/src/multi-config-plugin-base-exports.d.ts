import type { NormalizedOutputOptions, OutputBundle, Plugin, PluginContext } from 'rollup';

export type ExecuteFn = (this: PluginContext, options: NormalizedOutputOptions, bundle: OutputBundle) => void | Promise<void>;

export type OnFinalHook = (
    this: PluginContext,
    options: NormalizedOutputOptions,
    bundle: OutputBundle,
    remainingConfigsCount: number,
    remainingOutputsCount: number
) => void | Promise<void>;

export function multiConfigPluginBase(
    useWriteBundle: boolean,
    pluginName: string,
    execute: ExecuteFn,
    onFinalHook?: OnFinalHook
): Plugin & {
    api: {
        addInstance(): Plugin;
    };
};
