import fs from 'fs/promises';
import path from 'path';
import glob from 'tiny-glob';
import { PluginContext, Plugin } from 'rollup';
import { Logger, LogLevel } from '@niceties/logger';
import { getOptions } from '@rollup-extras/utils/options';
import statistics from '@rollup-extras/utils/statistics';
import logger from '@rollup-extras/utils/logger';
import type { AngularTemplatesCachePluginOptions, AngularTemplatesCachePluginOptionsFull } from './types';
import escapeString from 'js-string-escape';

const listFilenames = 'list-filenames';

const factories = { logger } as unknown as { logger: () => Logger };

const prefix = '\0templates:';

const defaultTemplatesGlob = './**/*.html';

export default function(options: AngularTemplatesCachePluginOptions = defaultTemplatesGlob) {

    let templatesMap: Map<string, string>,
        templateFiles: string[],
        scanPromise: Promise<void> | undefined;

    const normalizedOptions = getOptions(options, {
        pluginName: '@rollup-extras/plugin-angularjs-template-cache',
        templates: defaultTemplatesGlob,
        processHtml: (html: string) => html,
        transformTemplateUri: (uri: string) => uri,
        importAngular: true,
        angularModule: 'templates',
        module: 'templates',
        rootDir: '.',
        standalone: true,
        autoImport: false,
        watch: true,
        verbose: false as AngularTemplatesCachePluginOptionsFull['verbose'],
        useImports: false
    }, 'templates', factories);

    const { pluginName, templates, processHtml, transformTemplateUri, autoImport, importAngular,
        angularModule, module: module, standalone, verbose, logger, watch, rootDir, useImports } = normalizedOptions;
    
    const prefixedModuleName = prefix + module;

    return <Plugin>{
        name: pluginName,

        async buildStart() {
            if (autoImport) {
                scanPromise = scanForTemplates.apply(this);
                this.emitFile({
                    type: 'chunk',
                    id: prefixedModuleName
                });
            }            
        },

        resolveId(id) {
            if (id === module) {
                scanPromise = scanForTemplates.apply(this);
                return { id: prefixedModuleName, moduleSideEffects: standalone };
            }
            
            if (id === prefixedModuleName) {
                return { id: prefixedModuleName, moduleSideEffects: standalone };
            }
      
            return null;
        },
      
        async load(id) {
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
      
            return null;
        }
    };

    async function scanForTemplates(this: PluginContext) {
        templatesMap = new Map<string, string>;
        templateFiles = [];

        const results = [...new Set(
            (
                await Promise.all([templates].flat(2).map(templateGlob => glob(templateGlob)))
            ).flat(2)
        )];

        templateFiles = results;

        if (!useImports) {
            const statisticsCollector = statistics(
                verbose === listFilenames,
                (result: number | string[]) => `inlined ${typeof result == 'number' ? result + ' templates' : result.join(', ')}`
            );
            logger.start('inlining templates', verbose ? LogLevel.info : LogLevel.verbose);
            await Promise.all(results.map(async (fileName) => {
                const templateUri = getTemplateUri(fileName);
                try {
                    const fileStat = await fs.stat(fileName);
                    if (!fileStat.isFile()) {
                        return;
                    }
                    templatesMap.set(
                        templateUri,
                        escapeString(processHtml((await fs.readFile(fileName)).toString()))
                    );
                } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                    const loglevel: number | undefined = e['code'] === 'ENOENT' ? undefined : LogLevel.warn;
                    logger(`error reading file ${fileName}`, loglevel, e);
                    return;
                }
                if (verbose === listFilenames) {
                    logger(`\t${fileName} → ${templateUri}`, LogLevel.info);
                }
                statisticsCollector(templateUri);
            }));
            logger.finish(statisticsCollector() as string);
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
            return Array.from(templatesMap).map(entry => `$templateCache.put("${entry[0]}", "${entry[1]}");`).join('\n');
        }
    }

    function getTemplateUri(fileName: string) {
        return transformTemplateUri(fixSlashes(path.relative(rootDir, fileName)));
    }

    function fixSlashes(uri: string) {
        return uri.replaceAll('\\', '/');
    }
}