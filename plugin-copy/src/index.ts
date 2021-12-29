import fs from 'fs/promises';
import path from 'path';
import glob from 'glob-promise';
import globParent from 'glob-parent';
import { PluginContext, PluginHooks } from 'rollup';
import { CopyPluginOptions, SingleTargetDesc } from './types';
import { createLogger, LogLevel } from '@niceties/logger';
import { getOptions } from '@rollup-extras/utils/options';
import logger from '@rollup-extras/utils/logger';

type FileDesc = { dest: string[], copied: string[], timestamp: number };

type Logger = ReturnType<typeof createLogger>;

const factories = { targets, logger } as unknown as { targets: () => SingleTargetDesc[], logger: () => Logger };

export default function(options: CopyPluginOptions) {
    const files = new Map<string, {
        dest: string[],
        copied: string[],
        timestamp: number
    }>();

    const normalizedOptions = getOptions(options, {
        pluginName: '@rollup-extras/plugin-copy',
        copyOnce: true,
        flattern: false,
        verbose: false,
        exactFileNames: true,
        watch: true,
        emitFiles: true,
        outputPlugin: false
    }, 'targets', factories);

    const { pluginName, copyOnce, verbose, exactFileNames, targets, outputPlugin, flattern, emitFiles, logger } = normalizedOptions;
    let { watch } = normalizedOptions;

    const hookName = outputPlugin ? 'generateBundle' : emitFiles ? 'buildStart' : 'buildEnd';

    if (!outputPlugin && !emitFiles && watch) {
        watch = false;
        logger('can\'t use watch with emitFiles = false and outputPlugin = false', LogLevel.verbose);
    }

    if (outputPlugin && watch) {
        watch = false;
        logger('can\'t use watch with outputPlugin = true', LogLevel.verbose);
    }

    return <Partial<PluginHooks>>{
        name: pluginName,

        async [hookName]() {
            const results = await Promise.all((targets as SingleTargetDesc[]).map(target => glob(target.src, { ignore: target.exclude })
                .then((result: string[]) => ({
                    src: result,
                    dest: target.dest ? target.dest as string: '',
                    parent: globParent(target.src)
                }))));

            for (const result of results) {
                for (const file of result.src) {
                    let fileDesc: FileDesc;
                    if (files.has(file)) {
                        fileDesc = files.get(file) as FileDesc;
                    } else {
                        fileDesc = {
                            dest: [],
                            copied: [],
                            timestamp: 0
                        };
                        files.set(file, fileDesc);
                    }
                    const dest = flattern ? normalizeSlash(result.dest) : path.join(result.dest, path.relative(result.parent, path.dirname(file)));
                    if (!fileDesc.dest.includes(dest)) {
                        fileDesc.dest.push(dest);
                    }
                    // don't forget to watch it
                    if (watch) {
                        (this as unknown as PluginContext).addWatchFile(file);
                    }
                }
            }

            const statistics: string[] = [];
            logger.start('coping files', verbose ? LogLevel.info : LogLevel.verbose);
            for (const [fileName, fileDesc] of files) {
                try {
                    const fileStat = await fs.stat(fileName);
                    if (!fileStat.isFile() && !fileStat.isSymbolicLink()) {
                        continue;
                    }
                    const timestamp = fileStat.mtime.getTime();
                    if (timestamp > fileDesc.timestamp) {
                        fileDesc.timestamp = timestamp;
                        fileDesc.copied = [];
                    }
                    let source: Buffer | undefined;
                    if (emitFiles) {
                        source = await fs.readFile(fileName);
                    }
                    for (const dest of fileDesc.dest) {
                        if (copyOnce && fileDesc.copied.includes(dest)) {
                            continue;
                        }
                        const baseName = path.basename(fileName);
                        // path.join removes ./ from the beginning, that's needed for rollup name/fileName fields
                        const destFileName = path.join(dest, baseName);
                        if (emitFiles) {
                            (this as unknown as PluginContext).emitFile({
                                type: 'asset',
                                [exactFileNames ? 'fileName' : 'name']: destFileName,
                                source
                            });
                        } else {
                            await fs.mkdir(path.dirname(destFileName), { recursive: true });
                            await fs.copyFile(fileName, destFileName);
                        }
                        statistics.push(baseName);
                        fileDesc.copied.push(dest);
                    }
                } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                    const loglevel: number | undefined = e['code'] === 'ENOENT' ? undefined : LogLevel.warn;
                    logger(`error reading file ${fileName} ${e.stack}`, loglevel);
                }
            }
            logger.finish(`copied ${statistics.length > 5 ? statistics.length + ' files' : statistics.join(', ')}`);
        }
    };
}

function normalizeSlash(dir: string): string {
    if (dir.endsWith('/')) {
        return `${dir.substring(0, dir.length - 1)}`;
    }
    return dir;
}

function targets(options: CopyPluginOptions, field: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targets: SingleTargetDesc[]  = (options as never as any)[field];
    if (targets == null) {
        targets = [options] as SingleTargetDesc[];
    }
    if (Array.isArray(targets)) {
        targets = targets.map((item) => {
            if (item) {
                if (typeof item === 'string') {
                    return { src: item };
                }
                if (typeof item === 'object' && 'src' in item) {
                    return item;
                }
            }
            return undefined;
        }).filter(Boolean) as SingleTargetDesc[];
    }
    return targets;
}
