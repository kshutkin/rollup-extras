/**
 * @import { Plugin } from 'rollup'
 * @import { CommentType } from './scan-comments.js'
 */

import MagicString from 'magic-string';

import logger from '@rollup-extras/utils/logger';
import { getOptionsObject } from '@rollup-extras/utils/options';

import { isStrippableFile, parseCommentTypes, scanComments } from './scan-comments.js';

/**
 * @typedef {{ pluginName?: string, types?: CommentType | CommentType[] | readonly CommentType[] | true }} StripCommentsPluginOptionsObject
 */

/**
 * @typedef {StripCommentsPluginOptionsObject | CommentType | CommentType[] | readonly CommentType[] | true} StripCommentsPluginOptions
 */

const factories = { logger };

/**
 * @param {StripCommentsPluginOptions} [options]
 * @returns {Plugin}
 */
export default function (options) {
    const raw = typeof options === 'string' || Array.isArray(options) || options === true ? { types: options } : (options ?? {});

    const normalizedOptions = getOptionsObject(
        /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (raw)),
        {
            pluginName: '@rollup-extras/plugin-strip-comments',
            types: /** @type {CommentType[]} */ (['jsdoc', 'regular']),
        },
        factories
    );

    const { pluginName, types, logger } = normalizedOptions;

    /** @type {CommentType[] | readonly CommentType[] | true} */
    const typesValue = typeof types === 'string' ? [types] : types;
    const typesToStrip = parseCommentTypes(typesValue);

    return /** @type {Plugin} */ ({
        name: pluginName,

        renderChunk(code, chunk) {
            if (!isStrippableFile(chunk.fileName)) {
                return null;
            }

            const comments = scanComments(code);
            if (comments.length === 0) {
                return null;
            }

            const toRemove = comments.filter(c => typesToStrip.has(c.type));
            if (toRemove.length === 0) {
                return null;
            }

            const magicString = new MagicString(code, { filename: chunk.fileName });

            for (const { start, end } of toRemove) {
                magicString.remove(start, end);
            }

            logger(`stripped ${toRemove.length} comment(s) in ${chunk.fileName}`);

            return {
                code: magicString.toString(),
                map: magicString.generateMap({ hires: true }),
            };
        },
    });
}
