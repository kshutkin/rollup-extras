/**
 * @import { BinifyPluginOptions } from './types.js'
 */

/**
 * @param {BinifyPluginOptions} options
 * @returns {string}
 */
export function shebang(options) {
    let shebangValue = /** @type {string} */ (options.shebang);
    // we can have includes() here instead of endsWith()
    // and allow to do weird tricks with first line of js file
    // but it is not an intention of this plugin
    if (!shebangValue.endsWith('\n')) {
        shebangValue += '\n';
    }
    return shebangValue;
}
