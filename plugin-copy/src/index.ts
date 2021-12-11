import fs from 'fs/promises';
import path from 'path';
import glob from 'glob-promise';
import globParent from 'glob-parent';
import { PluginContext, PluginHooks } from 'rollup';
import { CopyPluginOptions, MultipleTargetsDesc, SingleTargetDesc } from './types';
import { createLogger, LogLevel } from '@niceties/logger';

type FileDesc = { dest: string[], copied: string[], timestamp: number };

export default function(options: CopyPluginOptions) {
    const files = new Map<string, {
        dest: string[],
        copied: string[],
        timestamp: number
    }>();

    const normilizedOptions = normalizeOptions(options);
    const { pluginName, copyOnce, verbose, exactFileNames, targets, outputPlugin, flattern, emitFiles } = normilizedOptions;
    let { watch } = normilizedOptions;

    const hookName = outputPlugin ? 'generateBundle' : emitFiles ? 'buildStart' : 'buildEnd';

    {
        const log = createLogger(pluginName);

        if (!outputPlugin && !emitFiles && watch) {
            watch = false;
            log('can\'t use watch with emitFiles = false and outputPlugin = false', LogLevel.verbose);
        }

        if (outputPlugin && watch) {
            watch = false;
            log('can\'t use watch with outputPlugin = true', LogLevel.verbose);
        }
    }

    return <Partial<PluginHooks>>{
        name: pluginName,

        async [hookName]() {
            const results = await Promise.all(targets.map(target => glob(target.src, { ignore: target.exclude })
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

            const logger = createLogger(pluginName);
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

type NormilizedOptions = {
    targets: SingleTargetDesc[],
    pluginName: string,
    copyOnce: boolean,
    verbose: boolean,
    flattern: boolean,
    exactFileNames: boolean,
    outputPlugin: boolean,
    watch: boolean,
    emitFiles: boolean,
}

function normalizeOptions(userOptions: CopyPluginOptions): NormilizedOptions {
    const options = {
        pluginName: (userOptions as NormilizedOptions).pluginName ?? '@rollup-extras/plugin-copy',
        copyOnce: (userOptions as NormilizedOptions).copyOnce ?? true,
        verbose: (userOptions as NormilizedOptions).verbose ?? false,
        flattern: (userOptions as NormilizedOptions).flattern ?? false,
        exactFileNames: (userOptions as NormilizedOptions).exactFileNames ?? true,
        outputPlugin: (userOptions as NormilizedOptions).outputPlugin ?? false,
        watch: (userOptions as NormilizedOptions).watch ?? true,
        emitFiles: (userOptions as NormilizedOptions).emitFiles ?? true,
        targets: getTargets(userOptions)
    };

    return options;
}
function getTargets(userOptions: CopyPluginOptions): SingleTargetDesc[] {
    if (typeof userOptions === 'string') {
        return [{ src: userOptions }];
    }
    if (Array.isArray(userOptions)) {
        return userOptions.map((item) => {
            if (typeof item === 'string' && item) {
                return { src: item };
            }
            if (typeof item === 'object') {
                return item;
            }
            return undefined;
        }).filter(Boolean) as SingleTargetDesc[];
    }
    if (typeof userOptions === 'object') {
        return 'targets' in userOptions ? getTargets(userOptions.targets as MultipleTargetsDesc) : [userOptions as SingleTargetDesc];
    }
    return [];
}

