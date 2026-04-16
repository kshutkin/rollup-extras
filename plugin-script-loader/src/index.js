import { readFile } from 'node:fs/promises';

/**
 * @import { PluginContext, Plugin } from 'rollup'
 */

/**
 * @typedef {{ prefix?: string, useStrict?: boolean, pluginName?: string, verbose?: boolean }} ScriptLoaderPluginOptions
 */

import { LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { getOptionsObject } from '@rollup-extras/utils/options';
import statistics from '@rollup-extras/utils/statistics';

const scriptPrefix = '\0script-loader:';

const factories = { logger };

/**
 * @param {ScriptLoaderPluginOptions} [options]
 * @returns {Plugin}
 */
export default function (options = {}) {
    const normalizedOptions = getOptionsObject(
        options,
        {
            pluginName: '@rollup-extras/plugin-script-loader',
            prefix: 'script!',
            useStrict: /** @type {boolean} */ (true),
            verbose: /** @type {boolean} */ (false),
        },
        factories
    );

    const { pluginName, prefix, useStrict, verbose, logger } = normalizedOptions;

    const statisticsCollector = statistics(
        false,
        (/** @type {number | string[]} */ result) => `inlined ${typeof result === 'number' ? `${result} scripts` : result.join(', ')}`
    );

    return /** @type {Plugin} */ ({
        name: pluginName,

        /** @this {PluginContext} */
        async resolveId(source, importer, resolveOptions) {
            if (!source.startsWith(prefix)) {
                return null;
            }

            const bareSpecifier = source.slice(prefix.length);

            // Resolve the real module using other plugins (e.g. node-resolve)
            const resolved = await this.resolve(bareSpecifier, importer, { ...resolveOptions, skipSelf: true });

            if (!resolved) {
                this.warn(`Could not resolve "${bareSpecifier}" (from "${source}")`);
                return null;
            }

            // Strip virtual module markers that other plugins may add:
            // - \0 prefix (e.g. from @rollup/plugin-commonjs)
            // - ?query suffix (e.g. ?commonjs-es-import)
            let resolvedPath = resolved.id;
            if (resolvedPath.startsWith('\0')) {
                resolvedPath = resolvedPath.slice(1);
            }
            const queryIndex = resolvedPath.indexOf('?');
            if (queryIndex !== -1) {
                resolvedPath = resolvedPath.slice(0, queryIndex);
            }

            // Return a virtual ID that maps back to the resolved file
            return {
                id: scriptPrefix + resolvedPath,
                moduleSideEffects: true,
            };
        },

        /** @this {PluginContext} */
        async load(id) {
            if (!id.startsWith(scriptPrefix)) {
                return null;
            }

            const realPath = id.slice(scriptPrefix.length);

            this.addWatchFile(realPath);

            logger.start('inlining scripts', verbose ? LogLevel.info : LogLevel.verbose);

            const code = (await readFile(realPath)).toString();

            const shortName = realPath.split('/').pop() ?? realPath;
            if (verbose) {
                logger(`\t${realPath}`, LogLevel.info);
            }
            statisticsCollector(shortName);

            logger.finish(/** @type {string} */ (statisticsCollector()));

            // Return the raw code as-is.
            // When useStrict is true, the empty export makes Rollup's parser
            // treat the file as an ES module (strict mode).
            // When useStrict is false, no export is appended so the parser
            // uses script (sloppy) mode — required for legacy code that uses
            // `with`, `arguments.callee`, or assigns to undeclared variables.
            // In both cases moduleSideEffects: true ensures the code is never
            // tree-shaken.
            return {
                code: useStrict ? code + '\nexport {}\n' : code,
                map: null,
                moduleSideEffects: true,
            };
        },
    });
}
