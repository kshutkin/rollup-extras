/**
 * @typedef {string | string[] | undefined} SimpleOptions
 */

/**
 * @template {Record<string, unknown>} T
 * @typedef {{ [key: string]: (options: Partial<T>, field: string) => unknown }} DefaultsFactory
 */

/**
 * @template {Record<string, unknown>} T
 * @template {DefaultsFactory<T>} F
 * @typedef {T & { [K in keyof F]: F[K] extends ((options: Partial<T>, field: string) => unknown) ? ReturnType<F[K]> : unknown }} Result
 */

export { multiConfigPluginBase } from './multi-config-plugin-base.js';
export { getOptions, getOptionsObject } from './options.js';
