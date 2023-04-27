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

    const templatesMap = new Map<string, string>;

    const normalizedOptions = getOptions(options, {
        pluginName: '@rollup-extras/plugin-angularjs-template-cache',
        templates: './**/*.html',
        exclude: '',
        processHtml: (html: string) => html,
        angularModule: 'templates',
        module: 'templates',
        rootDir: '.',
        standalone: true,
        watch: true,
        verbose: false as AngularTemplatesCachePluginOptionsFull['verbose']
    }, 'templates', factories);

    const { pluginName, templates, exclude: ignore, processHtml, angularModule, module: module, standalone, verbose, logger, watch, rootDir } = normalizedOptions;

    return <Plugin>{
        name: pluginName,

        async buildStart() {
            templatesMap.clear();

            const results = await glob(templates, { ignore });

            const statisticsCollector = statistics(
                verbose === listFilenames,
                (result: number | string[]) => `inlined ${typeof result == 'number' ? result + ' templates' : result.join(', ')}`
            );
            logger.start('inlining templates', verbose ? LogLevel.info : LogLevel.verbose);
            for (const fileName of results) {
                if (watch) {
                    (this as unknown as PluginContext).addWatchFile(fileName);
                }
                try {
                    const fileStat = await fs.stat(fileName);
                    if (!fileStat.isFile() && !fileStat.isSymbolicLink()) {
                        continue;
                    }
                    templatesMap.set(
                        path.relative(rootDir, fileName).replaceAll('\\', '/'), 
                        escapeString(processHtml((await fs.readFile(fileName)).toString()))
                    );
                } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                    const loglevel: number | undefined = e['code'] === 'ENOENT' ? undefined : LogLevel.warn;
                    logger(`error reading file ${fileName}`, loglevel, e);
                    continue;
                }
                const baseName = path.basename(fileName);
                if (verbose === listFilenames) {
                    logger(`\t${fileName}`, LogLevel.info);
                }
                statisticsCollector(baseName);
            }
            logger.finish(statisticsCollector() as string);
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
                        angular.module("${angularModule}"${standalone ? ', []' : ''}).run([
                            "$templateCache",
                            function ($templateCache) {
                                ${Array.from(templatesMap).map(entry => '$templateCache.put("' + entry[0] +'", "' + entry[1] + '");').join('\n')}
                            }
                        ]);
                        export default "${angularModule}";
                    `;
                }
            }
      
            return null;
        }
    };
}
