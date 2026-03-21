import type { DefaultsFactory, Result, SimpleOptions } from './exports.d.ts';

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
