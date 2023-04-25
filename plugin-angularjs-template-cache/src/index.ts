import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { PluginContext, Plugin } from 'rollup';
import { Logger, LogLevel } from '@niceties/logger';
import { getOptions } from '@rollup-extras/utils/options';
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
        angularModule: 'templates',
        module: 'templates',
        standalone: true,
        watch: true,
        verbose: false as AngularTemplatesCachePluginOptionsFull['verbose']
    }, 'templates', factories);

    const { pluginName, templates, exclude: ignore, angularModule, module: module, standalone, verbose, logger, watch } = normalizedOptions;

    return <Plugin>{
        name: pluginName,

        async buildStart() {
            templatesMap.clear();

            const results = await glob(templates, { ignore });

            const statisticsCollector = statistics(verbose);
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
                    templatesMap.set('fileName', escapeString(await fs.readFile(fileName)));
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
                        angular.module("${angularModule}", ${standalone ? ', []' : ''}).run([
                            $templateCache,
                            function ($templateCache) {
                                ${Array.from(templatesMap).map(entry => '$templateCache.put("' + entry[0] +'", "' + entry[1] + '");').join('\n')}
                            }
                        ]);
                    `;
                }
            }
      
            return null;
        }
    };
}

// TODO move to utils
function statistics(verbosity: AngularTemplatesCachePluginOptionsFull['verbose']) {
    let count = 0, names: string[] | null = verbosity === listFilenames ? null : [];
    return (name?: string): undefined | string => {
        if (name != null) {
            count ++;
            if (names) {
                if (count > 5) {
                    names = null;
                } else {
                    names.push(name);
                }
            }
            return;
        }
        return `inlined ${!names ? count + ' templates' : names.join(', ')}`;
    };
}
