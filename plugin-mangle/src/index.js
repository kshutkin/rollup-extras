/**
 * @import { Plugin } from 'rollup'
 * @import { Identifier, Literal, Property, Node } from 'estree'
 */

import { walk } from 'estree-walker';
import MagicString from 'magic-string';

import logger from '@rollup-extras/utils/logger';
import { getOptionsObject } from '@rollup-extras/utils/options';

/**
 * Parser-added position properties not present in estree types.
 * @typedef {{ start: number, end: number }} Loc
 */

/**
 * @typedef {{ pluginName?: string, prefix?: string }} ManglePluginOptionsObject
 */

/**
 * @typedef {ManglePluginOptionsObject | string} ManglePluginOptions
 */

const factories = { logger };

/**
 * @param {ManglePluginOptions} [options]
 * @returns {Plugin}
 */
export default function (options) {
    const normalizedOptions = getOptionsObject(
        typeof options === 'string' ? { prefix: options } : (options ?? {}),
        {
            pluginName: '@rollup-extras/plugin-mangle',
            prefix: '$_',
        },
        factories
    );

    const { pluginName, prefix, logger } = normalizedOptions;

    /** @type {Map<string, string>} */
    const propertyMap = new Map();
    let counter = 0;

    /**
     * @param {string} name
     * @returns {string}
     */
    const getMangled = name => {
        if (!propertyMap.has(name)) {
            let n = counter++;
            let result = '';
            do {
                result = String.fromCharCode(97 + (n % 26)) + result;
                n = Math.floor(n / 26) - 1;
            } while (n >= 0);
            propertyMap.set(name, result);
        }
        return /** @type {string} */ (propertyMap.get(name));
    };

    /**
     * @param {string | undefined} name
     * @returns {boolean | undefined}
     */
    const shouldMangle = name => name?.startsWith(prefix);

    return /** @type {Plugin} */ ({
        name: pluginName,

        buildStart() {
            propertyMap.clear();
            counter = 0;
        },

        renderChunk(code, chunk) {
            const ast = this.parse(code);
            const magicString = new MagicString(code, {
                filename: chunk.fileName,
            });

            let mangleCount = 0;

            walk(/** @type {Node} */ (/** @type {unknown} */ (ast)), {
                enter(node, parent) {
                    // Property in object literal or destructuring pattern: { $_prop: value } or { $_prop }
                    if (node.type === 'Property' && node.key.type === 'Identifier' && shouldMangle(node.key.name)) {
                        const key = /** @type {Identifier & Loc} */ (node.key);
                        const mangledName = getMangled(key.name);

                        if (/** @type {Property} */ (node).shorthand) {
                            magicString.overwrite(key.start, key.end, `${mangledName}: ${mangledName}`);
                        } else {
                            magicString.overwrite(key.start, key.end, mangledName);
                        }
                        mangleCount++;
                    }
                    // Member expression: obj.$_prop
                    else if (
                        node.type === 'MemberExpression' &&
                        !node.computed &&
                        node.property.type === 'Identifier' &&
                        shouldMangle(node.property.name)
                    ) {
                        const prop = /** @type {Identifier & Loc} */ (node.property);
                        magicString.overwrite(prop.start, prop.end, getMangled(prop.name));
                        mangleCount++;
                    }
                    // String literal containing a prefixed name (e.g. '$_flags')
                    else if (node.type === 'Literal' && typeof node.value === 'string' && shouldMangle(node.value)) {
                        const lit = /** @type {Literal & Loc} */ (node);
                        const raw = code.slice(lit.start, lit.end);
                        const quote = raw[0];
                        magicString.overwrite(lit.start, lit.end, quote + getMangled(/** @type {string} */ (lit.value)) + quote);
                        mangleCount++;
                    }
                    // Template literal with no interpolation that matches the prefix exactly
                    else if (
                        node.type === 'TemplateLiteral' &&
                        node.expressions.length === 0 &&
                        node.quasis.length === 1 &&
                        shouldMangle(node.quasis[0].value.cooked)
                    ) {
                        const tmpl = /** @type {import('estree').TemplateLiteral & Loc} */ (node);
                        magicString.overwrite(
                            tmpl.start,
                            tmpl.end,
                            `\`${getMangled(/** @type {string} */ (node.quasis[0].value.cooked))}\``
                        );
                        mangleCount++;
                    }
                    // Identifier used as variable that matches the prefix
                    else if (node.type === 'Identifier' && shouldMangle(node.name)) {
                        const isPropertyKey = parent?.type === 'Property' && parent.key === node;
                        const isShorthandValue =
                            parent?.type === 'Property' && /** @type {Property} */ (parent).shorthand && parent.value === node;
                        const isMemberProp = parent?.type === 'MemberExpression' && parent.property === node && !parent.computed;

                        if (!isPropertyKey && !isShorthandValue && !isMemberProp) {
                            const ident = /** @type {Identifier & Loc} */ (node);
                            magicString.overwrite(ident.start, ident.end, getMangled(ident.name));
                            mangleCount++;
                        }
                    }
                },
            });

            if (mangleCount > 0) {
                logger(`mangled ${mangleCount} references in ${chunk.fileName}`);
            }

            return {
                code: magicString.toString(),
                map: magicString.generateMap({ hires: true }),
            };
        },
    });
}
