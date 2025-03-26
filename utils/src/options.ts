import { DefaultsFactory, Result, SimpleOptions } from './types';

export function getOptions<T extends string | string[] | undefined | Record<string, unknown> | Record<string, unknown>[], D, F extends DefaultsFactory<Partial<{[K in C]: string[]}> & Partial<Exclude<T, SimpleOptions>>>, C extends string>(options: T | undefined, defaults: D | undefined, field: C, factory?: F) {
    const newOptions = recursiveArrayOptions(options, field);
    
    return getOptionsObject((newOptions ? (newOptions as unknown as {[K in C]: string[]}) : (options as Exclude<T, SimpleOptions>)) as Partial<{[K in C]: string[]}> & Partial<Exclude<T, SimpleOptions>>, defaults, factory);
}

function recursiveArrayOptions<T extends string | string[] | undefined | Record<string, unknown> | Record<string, unknown>[], C extends string>(options: T, field: C): undefined | { [K in C]: string[] } {
    if (typeof options === 'string') {
        return { [field]: [options] } as unknown as { [K in C]: string[] };
    } else if (Array.isArray(options)) {
        return { [field]: options } as unknown as { [K in C]: string[] };
    } else if (typeof options === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return field in options ? { ...(options as unknown as any), ...recursiveArrayOptions((options as unknown as Record<string, unknown>)[field] as SimpleOptions, field) as undefined | { [K in C]: string[] }} : options as undefined | { [K in C]: string[] };
    }
    console.warn(`cannot process options: '${options}', reverting to defaults`);
}

export function getOptionsObject<T extends {[key: string]: unknown}, D, F extends DefaultsFactory<T>>(options: T, defaults?: D, factory?: F) {
    const result = {...defaults, ...options} as Partial<Result<T, F>>;

    if (factory) {
        for(const [k, v] of Object.entries(factory)) {
            (result as {[key: string]: unknown})[k] = v(result, k);
        }
    }

    return result as Result<T, F> & D;
}
