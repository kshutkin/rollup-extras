/**
 * @import { DefaultsFactory, Result } from './index.js'
 */

/**
 * @template {string | string[] | undefined | Record<string, unknown> | Record<string, unknown>[]} T
 * @template D
 * @template {DefaultsFactory<Record<string, unknown>>} F
 * @template {string} C
 * @param {T | undefined} options
 * @param {D | undefined} defaults
 * @param {C} field
 * @param {F} [factory]
 */
export function getOptions(options, defaults, field, factory) {
    const newOptions = recursiveArrayOptions(options, field);

    return getOptionsObject(/** @type {Record<string, unknown>} */ (newOptions ?? options), defaults, factory);
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
        const optionsObj = /** @type {Record<string, unknown>} */ (options);
        return field in options
            ? {
                  ...optionsObj,
                  ...recursiveArrayOptions(
                      /** @type {string | string[] | undefined | Record<string, unknown> | Record<string, unknown>[]} */ (
                          optionsObj[field]
                      ),
                      field
                  ),
              }
            : optionsObj;
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
 * @returns {Result<T, F> & D}
 */
export function getOptionsObject(options, defaults, factory) {
    const result = { ...defaults, ...options };

    if (factory) {
        for (const [k, v] of Object.entries(factory)) {
            /** @type {Record<string, unknown>} */ (result)[k] = v(result, k);
        }
    }

    return /** @type {Result<T, F> & D} */ (/** @type {unknown} */ (result));
}
