import { glob, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

/**
 * @import { PluginContext, Plugin } from 'rollup'
 */

/**
 * @typedef {{ templates?: string | string[], watch?: boolean, rootDir?: string, transformTemplateUri?: (uri: string) => string, processHtml?: (html: string) => string, pluginName?: string, angularModule?: string, standalone?: boolean, module?: string, importAngular?: boolean, autoImport?: boolean, verbose?: boolean | 'list-filenames', useImports?: boolean, transformHtmlImportsToUris?: boolean }} AngularTemplatesCachePluginOptionsFull
 */

/**
 * @typedef {AngularTemplatesCachePluginOptionsFull | string | string[]} AngularTemplatesCachePluginOptions
 */

import escapeString from 'js-string-escape';

import { LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { getOptions } from '@rollup-extras/utils/options';
import statistics from '@rollup-extras/utils/statistics';

const listFilenames = 'list-filenames';

const factories = { logger };

const templatesPrefix = '\0templates:';
const templatePrefix = '\0template:';

const defaultTemplatesGlob = './**/*.html';

/**
 * @param {AngularTemplatesCachePluginOptions} [options]
 * @returns {Plugin}
 */
export default function (options = defaultTemplatesGlob) {
    /** @type {Map<string, string>} */
    let templatesMap;
    /** @type {string[]} */
    let templateFiles;
    /** @type {Promise<void> | undefined} */
    let scanPromise;

    const normalizedOptions = getOptions(
        options,
        {
            pluginName: '@rollup-extras/plugin-angularjs-template-cache',
            templates: defaultTemplatesGlob,
            processHtml: (/** @type {string} */ html) => html,
            transformTemplateUri: (/** @type {string} */ uri) => uri,
            importAngular: true,
            angularModule: 'templates',
            module: 'templates',
            rootDir: '.',
            standalone: true,
            autoImport: false,
            watch: true,
            verbose: /** @type {AngularTemplatesCachePluginOptionsFull['verbose']} */ (false),
            useImports: false,
            transformHtmlImportsToUris: false,
        },
        'templates',
        factories
    );

    const {
        pluginName,
        templates,
        processHtml,
        transformTemplateUri,
        autoImport,
        importAngular,
        transformHtmlImportsToUris,
        angularModule,
        module,
        standalone,
        verbose,
        logger,
        watch,
        rootDir,
        useImports,
    } = normalizedOptions;

    const prefixedModuleName = templatesPrefix + module;

    return /** @type {Plugin} */ ({
        name: pluginName,

        /** @this {PluginContext} */
        async buildStart() {
            if (autoImport) {
                scanPromise = scanForTemplates.apply(this);
                this.emitFile({
                    type: 'chunk',
                    id: prefixedModuleName,
                });
            }
        },

        /** @this {PluginContext} */
        resolveId(/** @type {string} */ id, /** @type {string | undefined} */ importer) {
            if (transformHtmlImportsToUris && id.endsWith('.html')) {
                return { id: templatePrefix + (importer ? join(dirname(importer), id) : id), moduleSideEffects: false };
            }

            if (id === module) {
                scanPromise = scanForTemplates.apply(this);
                return { id: prefixedModuleName, moduleSideEffects: standalone };
            }

            if (id === prefixedModuleName) {
                return { id: prefixedModuleName, moduleSideEffects: standalone };
            }

            return null;
        },

        /** @this {PluginContext} */
        async load(/** @type {string} */ id) {
            if (id === prefixedModuleName) {
                await scanPromise;

                if (watch) {
                    for (const fileName of templateFiles) {
                        this.addWatchFile(fileName);
                    }
                }

                return `
                    ${importAngular ? 'import angular from "angular";' : ''}
                    ${getImports()}
                    angular.module("${angularModule}"${standalone ? ', []' : ''}).run([
                        "$templateCache",
                        function ($templateCache) {
                            ${getPopulateCacheCode()}
                        }
                    ]);
                    export default "${angularModule}";
                `;
            }

            if (id.startsWith(templatePrefix)) {
                const realId = id.slice(templatePrefix.length);
                return `export default "${getTemplateUri(realId)}";`;
            }

            return null;
        },
    });

    /** @this {PluginContext} */
    async function scanForTemplates() {
        templatesMap = new Map();
        templateFiles = [];

        const results = [
            ...new Set((await Promise.all([templates].flat(2).map(templateGlob => Array.fromAsync(glob(templateGlob))))).flat(2)),
        ];

        templateFiles = results;

        if (!useImports) {
            const statisticsCollector = statistics(
                verbose === listFilenames,
                (/** @type {number | string[]} */ result) =>
                    `inlined ${typeof result === 'number' ? `${result} templates` : result.join(', ')}`
            );
            logger.start('inlining templates', verbose ? LogLevel.info : LogLevel.verbose);
            await Promise.all(
                results.map(async fileName => {
                    const templateUri = getTemplateUri(fileName);
                    try {
                        const fileStat = await stat(fileName);
                        if (!fileStat.isFile()) {
                            return;
                        }
                        templatesMap.set(templateUri, escapeString(processHtml((await readFile(fileName)).toString())));
                    } catch (e) {
                        const loglevel = /** @type {{ code: string }} */ (e).code === 'ENOENT' ? undefined : LogLevel.warn;
                        logger(`error reading file ${fileName}`, loglevel, e);
                        return;
                    }
                    if (verbose === listFilenames) {
                        logger(`\t${fileName} → ${templateUri}`, LogLevel.info);
                    }
                    statisticsCollector(templateUri);
                })
            );
            logger.finish(/** @type {string} */ (statisticsCollector()));
        }
    }

    function getImports() {
        if (useImports) {
            return templateFiles.map((value, index) => `import template${index} from './${fixSlashes(value)}';`).join('\n');
        }
        return '';
    }

    function getPopulateCacheCode() {
        if (useImports) {
            return templateFiles.map((value, index) => `$templateCache.put("${getTemplateUri(value)}", template${index});`).join('\n');
        } else {
            return Array.from(templatesMap)
                .map(entry => `$templateCache.put("${entry[0]}", "${entry[1]}");`)
                .join('\n');
        }
    }

    /**
     * @param {string} fileName
     * @returns {string}
     */
    function getTemplateUri(fileName) {
        return transformTemplateUri(fixSlashes(relative(rootDir, fileName)));
    }

    /**
     * @param {string} uri
     * @returns {string}
     */
    function fixSlashes(uri) {
        return uri.replaceAll('\\', '/');
    }
}
