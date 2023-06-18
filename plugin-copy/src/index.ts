import fs from 'fs/promises';
import fs_ from 'fs';
import path from 'path';
import { glob } from 'glob';
import globParent from 'glob-parent';
import { PluginContext, Plugin } from 'rollup';
import { CopyPluginOptions, NonTargetOptions, SingleTargetDesc } from './types';
import { createLogger, LogLevel } from '@niceties/logger';
import { getOptions } from '@rollup-extras/utils/options';
import logger from '@rollup-extras/utils/logger';
import statistics from '@rollup-extras/utils/statistics';

const enum CopyMethod { Copy, Link, CopyLinks }

type FileDesc = { dest: string[], copied: string[], timestamp: number };

type Logger = ReturnType<typeof createLogger>;

const factories = { targets, logger, emitFiles } as unknown as {
    targets: () => SingleTargetDesc[],
    logger: () => Logger,
    emitFiles: () => boolean
};

const listFilenames = 'list-filenames';

export default function(options: CopyPluginOptions) {
    const files = new Map<string, {
        dest: string[],
        copied: string[],
        timestamp: number
    }>();

    const normalizedOptions = getOptions(options, {
        pluginName: '@rollup-extras/plugin-copy',
        copyOnce: true,
        flatten: false,
        verbose: false as NonTargetOptions['verbose'],
        exactFileNames: true,
        watch: true,
        emitFiles: true,
        outputPlugin: false,
        copyMethod: CopyMethod.Copy
    }, 'targets', factories);

    const { pluginName, copyOnce, verbose, exactFileNames, targets, outputPlugin, flatten, emitFiles, logger, copyMethod } = normalizedOptions;

    console.log(emitFiles, copyMethod);

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

    return <Plugin>{
        name: pluginName,

        async [hookName]() {
            const results = await Promise.all((targets as SingleTargetDesc[])
                .flatMap(target => Array.isArray(target.src) ? target.src.map(itemSrc => ({
                    ...target,
                    src: itemSrc
                })) : target)
                .map(target => glob(target.src, { ignore: target.exclude })
                    .then(result => ({
                        src: result,
                        dest: target.dest ? target.dest : '',
                        parent: globParent(target.src as string)
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
                    const dest = flatten ? normalizeSlash(result.dest) : path.join(result.dest, path.relative(result.parent, path.dirname(file)));
                    if (!fileDesc.dest.includes(dest)) {
                        fileDesc.dest.push(dest);
                    }
                    // don't forget to watch it
                    if (watch) {
                        (this as unknown as PluginContext).addWatchFile(file);
                    }
                }
            }

            const statisticsCollector = statistics(
                verbose === listFilenames,
                (result: number | string[]) => `copied ${typeof result == 'number' ? result + ' files' : result.join(', ')}`
            );
            logger.start('coping files', verbose ? LogLevel.info : LogLevel.verbose);
            await Promise.all([...files].map(async ([fileName, fileDesc]) => {
                let source: Buffer | undefined;
                let isSymbolicLink: boolean | undefined;
                try {
                    const fileStat = await fs.lstat(fileName);
                    isSymbolicLink = fileStat.isSymbolicLink();
                    if (!fileStat.isFile() && !isSymbolicLink) {
                        return;
                    }                    
                    const timestamp = fileStat.mtime.getTime();
                    if (timestamp > fileDesc.timestamp) {
                        fileDesc.timestamp = timestamp;
                        fileDesc.copied = [];
                    }
                    if (emitFiles) {
                        source = await fs.readFile(fileName);
                    }
                } catch (e: unknown) {
                    const loglevel: number | undefined = (e as { code: string })['code'] === 'ENOENT' ? undefined : LogLevel.warn;
                    logger(`error reading file ${fileName}`, loglevel, e);
                    return;
                }
                for (const dest of fileDesc.dest) {
                    if (copyOnce && fileDesc.copied.includes(dest)) {
                        continue;
                    }
                    const baseName = path.basename(fileName);
                    // path.join removes ./ from the beginning, that's needed for rollup name/fileName fields
                    const destFileName = path.join(dest, baseName);
                    try {
                        if (emitFiles) {
                            (this as unknown as PluginContext).emitFile({
                                type: 'asset',
                                [exactFileNames ? 'fileName' : 'name']: destFileName,
                                source
                            });
                        } else {
                            await fs.mkdir(path.dirname(destFileName), { recursive: true });
                            if (copyMethod === CopyMethod.Copy || (!isSymbolicLink && copyMethod === CopyMethod.CopyLinks)) {
                                await fs.copyFile(fileName, destFileName, fs_.constants.COPYFILE_FICLONE);
                            } else {
                                // naive implementation for CopyMethod.Link
                                const path = await fs.realpath(fileName);
                                await fs.symlink(path, destFileName);
                            }
                        }
                        if (verbose === listFilenames) {
                            logger(`\t${fileName} → ${destFileName}`, LogLevel.info);
                        }
                        statisticsCollector(baseName);
                        fileDesc.copied.push(dest);
                    } catch (e) {
                        logger(`error copying file ${fileName} → ${destFileName}`, LogLevel.warn, e);
                    }
                }
            }));
            logger.finish(statisticsCollector() as string);
        }
    };
}

function normalizeSlash(dir: string): string {
    if (dir.endsWith('/')) {
        return `${dir.substring(0, dir.length - 1)}`;
    }
    return dir;
}

function targets(options: CopyPluginOptions, field: 'targets') {
    let targets = (options as NonTargetOptions)[field];
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

function emitFiles(options: CopyPluginOptions, field: 'emitFiles') {
    const value = (options as NonTargetOptions)[field];
    if (value === 'copy-symlinks' || value === 'link-only') {
        (options as unknown as {copyMethod: CopyMethod}).copyMethod = value === 'copy-symlinks' ? CopyMethod.CopyLinks : CopyMethod.Link;
        return false;
    }
    return value;
}
