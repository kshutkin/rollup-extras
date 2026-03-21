import type { NormalizedOutputOptions, OutputBundle, Plugin, PluginContext } from 'rollup';

export type SimpleOptions = string | string[] | undefined;

export type DefaultsFactory<T extends Record<string, unknown>> = {
    [key: string]: (options: Partial<T>, field: string) => unknown;
};

export type Result<T extends Record<string, unknown>, F extends DefaultsFactory<T>> = T & {
    [K in keyof F]: F[K] extends (options: Partial<T>, field: string) => unknown ? ReturnType<F[K]> : unknown;
};

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

export function getOptions<
    T extends string | string[] | undefined | Record<string, unknown> | Record<string, unknown>[],
    D,
    F extends DefaultsFactory<Partial<{ [K in C]: string[] }> & Partial<Exclude<T, SimpleOptions>>>,
    C extends string,
>(
    options: T | undefined,
    defaults: D | undefined,
    field: C,
    factory?: F
): Result<Partial<{ [K in C]: string[] }> & Partial<Exclude<T, SimpleOptions>>, F> & D;

export function getOptionsObject<T extends Record<string, unknown>, D, F extends DefaultsFactory<T>>(
    options: T,
    defaults?: D,
    factory?: F
): Result<T, F> & D;
