import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { PluginContext, Plugin } from 'rollup';
import { Logger, LogLevel } from '@niceties/logger';
import { getOptions } from '@rollup-extras/utils/options';
import statistics from '@rollup-extras/utils/statistics';
import logger from '@rollup-extras/utils/logger';
import type { AngularTemplatesCachePluginOptions, AngularTemplatesCachePluginOptionsFull } from './types';
import escapeString from 'js-string-escape';

const listFilenames = 'list-filenames';

const factories = { logger } as unknown as { logger: () => Logger };

// eslint-disable-next-line quotes
const prefix = `\0templates:`;

export default function(options: AngularTemplatesCachePluginOptions) {

    let templatesMap: Map<string, string> | string[];

    const normalizedOptions = getOptions(options, {
        pluginName: '@rollup-extras/plugin-angularjs-template-cache',
        templates: './**/*.html',
        exclude: '',
        processHtml: (html: string) => html,
        transformTemplateUri: (uri: string) => uri,
        angularModule: 'templates',
        module: 'templates',
        rootDir: '.',
        standalone: true,
        watch: true,
        verbose: false as AngularTemplatesCachePluginOptionsFull['verbose'],
        useImports: false
    }, 'templates', factories);

    const { pluginName, templates, exclude: ignore, processHtml, transformTemplateUri,
        angularModule, module: module, standalone, verbose, logger, watch, rootDir, useImports } = normalizedOptions;

    return <Plugin>{
        name: pluginName,

        async buildStart() {
            templatesMap = useImports ? [] : new Map<string, string>;

            const results = [...new Set(
                (
                    await Promise.all([templates].flat(2).map(templateGlob => glob(templateGlob, { ignore })))
                ).flat(2)
            )];

            if (useImports) {
                templatesMap = results;
            } else {
                const statisticsCollector = statistics(
                    verbose === listFilenames,
                    (result: number | string[]) => `inlined ${typeof result == 'number' ? result + ' templates' : result.join(', ')}`
                );
                logger.start('inlining templates', verbose ? LogLevel.info : LogLevel.verbose);
                await Promise.all(results.map(async (fileName) => {
                    if (watch) {
                        (this as unknown as PluginContext).addWatchFile(fileName);
                    }
                    const templateUri = getTemplateUri(fileName);
                    try {
                        const fileStat = await fs.stat(fileName);
                        if (!fileStat.isFile() && !fileStat.isSymbolicLink()) {
                            return;
                        }                    
                        (templatesMap as Map<string, string>).set(
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
        },

        resolveId(id) {
            if (id === module) return { id: prefix + id, moduleSideEffects: standalone };
      
            return null;
        },
      
        load(id) {
            if (id.startsWith(prefix)) {
                const idNoPrefix = id.slice(prefix.length);
      
                if (idNoPrefix === module) {
                    return `
                        import angular from "angular";
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
            }
      
            return null;
        }
    };

    function getImports() {
        if (useImports) {
            return (templatesMap as string[]).map((value, index) => `import template${index} from './${value}';`).join('\n');
        }
        return '';
    }

    function getPopulateCacheCode() {
        if (useImports) {
            return (templatesMap as string[]).map((value, index) => `$templateCache.put("${getTemplateUri(value)}", template${index});`).join('\n');
        } else {
            return Array.from(templatesMap as Map<string, string>).map(entry => `$templateCache.put("${entry[0]}", "${entry[1]}");`).join('\n');
        }
    }

    function getTemplateUri(fileName: string) {
        return transformTemplateUri(path.relative(rootDir, fileName).replaceAll('\\', '/'));
    }
}