/**
 * @import { DefaultsFactory } from './index.js'
 */

/**
 * @template {string | string[] | undefined | Record<string, unknown> | Record<string, unknown>[]} T
 * @template D
 * @template {DefaultsFactory<any>} F
 * @template {string} C
 * @param {T | undefined} options
 * @param {D | undefined} defaults
 * @param {C} field
 * @param {F} [factory]
 */
export function getOptions(options, defaults, field, factory) {
    const newOptions = recursiveArrayOptions(options, field);

    return getOptionsObject(/** @type {any} */ (newOptions ? newOptions : options), defaults, factory);
}

/**
 * @template {string | string[] | undefined | Record<string, unknown> | Record<string, unknown>[]} T
 * @template {string} C
 * @param {T} options
 * @param {C} field
 * @returns {undefined | Record<string, unknown>}
 */
function recursiveArrayOptions(options, field) {
    if (typeof options === 'string') {
        return { [field]: [options] };
    } else if (Array.isArray(options)) {
        return { [field]: options };
    } else if (typeof options === 'object') {
        return field in options
            ? { .../** @type {any} */ (options), ...recursiveArrayOptions(/** @type {any} */ (options)[field], field) }
            : /** @type {any} */ (options);
    }
    console.warn(`cannot process options: '${options}', reverting to defaults`);
}

/**
 * @template {Record<string, unknown>} T
 * @template D
 * @template {DefaultsFactory<T>} F
 * @param {T} options
 * @param {D} [defaults]
 * @param {F} [factory]
 * @returns {any}
 */
export function getOptionsObject(options, defaults, factory) {
    const result = { ...defaults, ...options };

    if (factory) {
        for (const [k, v] of Object.entries(factory)) {
            /** @type {Record<string, unknown>} */ (result)[k] = v(result, k);
        }
    }

    return result;
}
