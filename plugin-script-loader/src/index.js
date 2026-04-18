import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import MagicString, { Bundle } from 'magic-string';

/**
 * @import { PluginContext, Plugin, OutputBundle, SourceMap } from 'rollup'
 */

/**
 * @typedef {{
 *   prefix?: string,
 *   useStrict?: boolean,
 *   pluginName?: string,
 *   verbose?: boolean,
 *   emit?: 'inline' | 'asset',
 *   name?: string,
 *   exactFileName?: boolean,
 *   sourcemap?: boolean,
 *   minify?: (code: string, sourcemap?: SourceMap) => Promise<{ code: string, map?: SourceMap }>
 * }} ScriptLoaderPluginOptions
 */

/**
 * @typedef {{
 *   filePath: string,
 *   code: string,
 *   originalMap?: SourceMap
 * }} ScriptEntry
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
            emit: /** @type {'inline' | 'asset'} */ ('inline'),
            name: 'vendor.js',
            exactFileName: /** @type {boolean} */ (true),
            sourcemap: /** @type {boolean | undefined} */ (undefined),
            minify: /** @type {((code: string, sourcemap?: SourceMap) => Promise<{ code: string, map?: SourceMap }>) | undefined} */ (
                undefined
            ),
        },
        factories
    );

    const { pluginName, prefix, useStrict, verbose, logger, emit, name, exactFileName, minify } = normalizedOptions;

    // Default sourcemap to true when emit: 'asset', false otherwise
    const sourcemap = normalizedOptions.sourcemap ?? emit === 'asset';

    const statisticsCollector = statistics(
        false,
        (/** @type {number | string[]} */ result) => `inlined ${typeof result === 'number' ? `${result} scripts` : result.join(', ')}`
    );

    // Collection state for emit: 'asset' mode
    /** @type {Map<string, ScriptEntry>} */
    const scripts = new Map();

    // Track import order: array of virtual IDs in the order they appear in source
    /** @type {string[]} */
    const importOrder = [];

    /**
     * Try to read an existing sourcemap for a file
     * @param {string} filePath
     * @param {string} code
     * @returns {Promise<SourceMap | undefined>}
     */
    async function tryReadSourcemap(filePath, code) {
        // Check for inline sourcemap
        const inlineMatch = code.match(
            /\/\/[#@]\s*sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)\s*$/
        );
        if (inlineMatch) {
            try {
                const decoded = Buffer.from(inlineMatch[1], 'base64').toString('utf8');
                return JSON.parse(decoded);
            } catch {
                // Ignore invalid inline maps
            }
        }

        // Check for external sourcemap file
        const externalMatch = code.match(/\/\/[#@]\s*sourceMappingURL=(.+?)\s*$/);
        if (externalMatch && !externalMatch[1].startsWith('data:')) {
            try {
                const mapPath = `${filePath}.map`;
                const mapContent = await readFile(mapPath, 'utf8');
                return JSON.parse(mapContent);
            } catch {
                // Ignore missing or invalid external maps
            }
        }

        return undefined;
    }

    /**
     * Strip sourceMappingURL comment from code
     * @param {string} code
     * @returns {string}
     */
    function stripSourcemapComment(code) {
        return code.replace(/\n?\/\/[#@]\s*sourceMappingURL=.+?\s*$/, '');
    }

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

            const virtualId = scriptPrefix + resolvedPath;

            // Return a virtual ID that maps back to the resolved file
            return {
                id: virtualId,
                moduleSideEffects: true,
            };
        },

        /**
         * Track import order from the module graph
         * @this {PluginContext}
         */
        moduleParsed(moduleInfo) {
            if (emit !== 'asset') {
                return;
            }

            // Find script-loader imports in this module and record their order
            for (const importedId of moduleInfo.importedIds) {
                if (importedId.startsWith(scriptPrefix) && !importOrder.includes(importedId)) {
                    importOrder.push(importedId);
                }
            }
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

            const shortName = /** @type {string} */ (realPath.split('/').pop());
            if (verbose) {
                logger(`\t${realPath}`, LogLevel.info);
            }
            statisticsCollector(shortName);

            logger.finish(/** @type {string} */ (statisticsCollector()));

            if (emit === 'asset') {
                // For emit: 'asset' mode, collect script for later concatenation
                // Try to read existing sourcemap
                const originalMap = sourcemap ? await tryReadSourcemap(realPath, code) : undefined;
                const cleanCode = stripSourcemapComment(code);

                scripts.set(id, {
                    filePath: realPath,
                    code: cleanCode,
                    originalMap,
                });

                // Return a placeholder that keeps the import in the graph
                return {
                    code: `/* [script-loader] externalized: ${realPath} */\n`,
                    map: null,
                    moduleSideEffects: true,
                };
            }

            // emit: 'inline' mode - current behavior
            // Return the raw code as-is.
            // When useStrict is true, the empty export makes Rollup's parser
            // treat the file as an ES module (strict mode).
            // When useStrict is false, no export is appended so the parser
            // uses script (sloppy) mode — required for legacy code that uses
            // `with`, `arguments.callee`, or assigns to undeclared variables.
            // In both cases moduleSideEffects: true ensures the code is never
            // tree-shaken.
            return {
                code: useStrict ? `${code}\nexport {}\n` : code,
                map: null,
                moduleSideEffects: true,
            };
        },

        /** @this {PluginContext} */
        async generateBundle(_outputOptions, bundle) {
            if (emit !== 'asset' || scripts.size === 0) {
                return;
            }

            // Sort script entries by their order in importOrder (which reflects source order)
            // Fall back to Map insertion order if not found in importOrder
            const sortedEntries = Array.from(scripts.entries())
                .sort(([idA], [idB]) => {
                    const orderA = importOrder.indexOf(idA);
                    const orderB = importOrder.indexOf(idB);
                    // If both found, sort by order; if not found, preserve relative order
                    if (orderA !== -1 && orderB !== -1) {
                        return orderA - orderB;
                    }
                    if (orderA !== -1) return -1;
                    if (orderB !== -1) return 1;
                    return 0;
                })
                .map(([, entry]) => entry);

            // Build concatenated code and sourcemap using MagicString Bundle
            const magicBundle = new Bundle({ separator: '\n' });

            for (const entry of sortedEntries) {
                const ms = new MagicString(entry.code, {
                    filename: entry.filePath,
                });

                // If entry has an original sourcemap, we need to handle it
                // For now, we'll let MagicString generate fresh mappings
                // and the original file content will be used as the source
                magicBundle.addSource({
                    filename: entry.filePath,
                    content: ms,
                });
            }

            let concatenatedCode = magicBundle.toString();
            /** @type {SourceMap | undefined} */
            let generatedMap;

            if (sourcemap) {
                generatedMap = /** @type {SourceMap} */ (
                    magicBundle.generateMap({
                        file: name,
                        source: name,
                        includeContent: true,
                        hires: true,
                    })
                );
            }

            // Apply minification if configured
            if (minify) {
                try {
                    const minified = await minify(concatenatedCode, generatedMap);
                    concatenatedCode = minified.code;
                    if (minified.map) {
                        generatedMap = minified.map;
                    }
                } catch (err) {
                    this.error(`Minification failed: ${err instanceof Error ? err.message : String(err)}`);
                }
            }

            // Emit main asset WITHOUT sourceMappingURL first
            const assetRefId = this.emitFile({
                type: 'asset',
                [exactFileName ? 'fileName' : 'name']: name,
                source: concatenatedCode,
            });

            // Get the final filename (may include hash if exactFileName: false)
            const finalFileName = this.getFileName(assetRefId);

            // Emit sourcemap and update main asset (if enabled)
            if (sourcemap && generatedMap) {
                // Compute sourcemap filename based on the (possibly hashed) main filename
                const mapFileName = `${finalFileName}.map`;

                // Update the sourcemap's file property to match the actual filename
                generatedMap.file = basename(finalFileName);

                // Emit sourcemap with EXACT fileName (no additional hashing)
                this.emitFile({
                    type: 'asset',
                    fileName: mapFileName,
                    source: JSON.stringify(generatedMap),
                });

                // Modify main asset in bundle to add sourceMappingURL
                const bundleEntry = bundle[finalFileName];
                if (bundleEntry && bundleEntry.type === 'asset' && typeof bundleEntry.source === 'string') {
                    bundleEntry.source += `\n//# sourceMappingURL=${basename(mapFileName)}`;
                }
            }

            if (verbose) {
                const fileList = sortedEntries.map(e => basename(e.filePath)).join(', ');
                logger(`emitted ${name} containing: ${fileList}`, LogLevel.info);
            }
        },

        // Cleanup after generateBundle completes (for watch mode support)
        closeBundle() {
            scripts.clear();
            importOrder.length = 0;
        },
    });
}
