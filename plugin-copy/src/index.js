import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readlink, stat, symlink } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';

import globParent from 'glob-parent';

import { globFiles } from './glob.js';

/**
 * @import { PluginContext, Plugin, EmittedFile } from 'rollup'
 */

/**
 * @typedef {{ src: string | string[], exclude?: string | string[], dest?: string }} SingleTargetDesc
 */

/**
 * @typedef {string | string[] | SingleTargetDesc | SingleTargetDesc[]} MultipleTargetsDesc
 */

/**
 * @typedef {{ targets?: MultipleTargetsDesc, pluginName?: string, copyOnce?: boolean, watch?: boolean, verbose?: boolean | 'list-filenames', flatten?: boolean, exactFileNames?: boolean, outputPlugin?: boolean, emitFiles?: boolean, emitOriginalFileName?: 'absolute' | 'relative' | ((fileName: string) => string), preserveSymlinks?: boolean }} NonTargetOptions
 */

/**
 * @typedef {NonTargetOptions | MultipleTargetsDesc} CopyPluginOptions
 */

import { createLogger, LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { getOptions } from '@rollup-extras/utils/options';
import statistics from '@rollup-extras/utils/statistics';

/**
 * @typedef {{ dest: string[], copied: string[], timestamp: number }} FileDesc
 */

/** @typedef {ReturnType<typeof createLogger>} Logger */

const factories = {
    targets,
    logger: /** @type {(options: Record<string, unknown>, field: string) => ReturnType<typeof createLogger>} */ (
        /** @type {unknown} */ (logger)
    ),
};

const listFilenames = 'list-filenames';

/**
 * @param {CopyPluginOptions} options
 * @returns {Plugin}
 */
export default function (options) {
    /** @type {Map<string, FileDesc>} */
    const files = new Map();

    const normalizedOptions = getOptions(
        options,
        {
            pluginName: '@rollup-extras/plugin-copy',
            copyOnce: true,
            flatten: false,
            verbose: /** @type {NonTargetOptions['verbose']} */ (false),
            exactFileNames: true,
            watch: true,
            emitFiles: true,
            outputPlugin: false,
            emitOriginalFileName: /** @type {const} */ ('absolute'),
            preserveSymlinks: false,
        },
        'targets',
        factories
    );

    const {
        pluginName,
        copyOnce,
        verbose,
        exactFileNames,
        targets,
        outputPlugin,
        flatten,
        emitFiles,
        logger,
        emitOriginalFileName,
        preserveSymlinks,
    } = normalizedOptions;
    let { watch } = normalizedOptions;

    const hookName = outputPlugin ? 'generateBundle' : emitFiles ? 'buildStart' : 'buildEnd';

    if (!outputPlugin && !emitFiles && watch) {
        watch = false;
        logger("can't use watch with emitFiles = false and outputPlugin = false", LogLevel.verbose);
    }

    if (outputPlugin && watch) {
        watch = false;
        logger("can't use watch with outputPlugin = true", LogLevel.verbose);
    }

    if (preserveSymlinks && emitFiles) {
        logger('preserveSymlinks has no effect with emitFiles = true, symlinks will be dereferenced', LogLevel.verbose);
    }

    return /** @type {Plugin} */ ({
        name: pluginName,

        async [hookName]() {
            const results = await Promise.all(
                /** @type {SingleTargetDesc[]} */ (targets)
                    .flatMap(target =>
                        Array.isArray(target.src)
                            ? target.src.map(itemSrc => ({
                                  ...target,
                                  src: itemSrc,
                              }))
                            : target
                    )
                    .map(target =>
                        globFiles(/** @type {string} */ (target.src), target.exclude).then(result => ({
                            src: result,
                            dest: target.dest ? target.dest : '',
                            parent: globParent(/** @type {string} */ (target.src)),
                        }))
                    )
            );

            for (const result of results) {
                for (const file of result.src) {
                    /** @type {FileDesc} */
                    let fileDesc;
                    if (files.has(file)) {
                        fileDesc = /** @type {FileDesc} */ (files.get(file));
                    } else {
                        fileDesc = {
                            dest: [],
                            copied: [],
                            timestamp: 0,
                        };
                        files.set(file, fileDesc);
                    }
                    const dest = flatten ? normalizeSlash(result.dest) : join(result.dest, relative(result.parent, dirname(file)));
                    if (!fileDesc.dest.includes(dest)) {
                        fileDesc.dest.push(dest);
                    }
                    // don't forget to watch it
                    if (watch) {
                        /** @type {PluginContext} */ (/** @type {unknown} */ (this)).addWatchFile(file);
                    }
                }
            }

            const statisticsCollector = statistics(
                verbose === listFilenames,
                (/** @type {number | string[]} */ result) => `copied ${typeof result === 'number' ? `${result} files` : result.join(', ')}`
            );
            logger.start('copying files', verbose ? LogLevel.info : LogLevel.verbose);
            await Promise.all(
                [...files].map(async ([fileName, fileDesc]) => {
                    /** @type {Buffer | undefined} */
                    let source;
                    /** @type {string | undefined} */
                    let linkTarget;
                    try {
                        const fileStat = preserveSymlinks && !emitFiles ? await lstat(fileName) : await stat(fileName);
                        if (preserveSymlinks && fileStat.isSymbolicLink()) {
                            linkTarget = await readlink(fileName);
                        } else if (!fileStat.isFile()) {
                            return;
                        }
                        const timestamp = fileStat.mtime.getTime();
                        if (timestamp > fileDesc.timestamp) {
                            fileDesc.timestamp = timestamp;
                            fileDesc.copied = [];
                        }
                        if (!linkTarget && emitFiles) {
                            source = await readFile(fileName);
                        }
                    } catch (/** @type {unknown} */ e) {
                        const loglevel = /** @type {{ code: string }} */ (e).code === 'ENOENT' ? undefined : LogLevel.warn;
                        logger(`error reading file ${fileName}`, loglevel, /** @type {Error | undefined} */ (e));
                        return;
                    }
                    for (const dest of fileDesc.dest) {
                        if (copyOnce && fileDesc.copied.includes(dest)) {
                            continue;
                        }
                        const baseName = basename(fileName);
                        // join removes ./ from the beginning, that's needed for rollup name/fileName fields
                        const destFileName = join(dest, baseName);
                        try {
                            if (linkTarget) {
                                await mkdir(dirname(destFileName), { recursive: true });
                                await symlink(linkTarget, destFileName);
                            } else if (emitFiles) {
                                /** @type {PluginContext} */ (/** @type {unknown} */ (this)).emitFile(
                                    /** @type {EmittedFile} */ ({
                                        type: 'asset',
                                        [exactFileNames ? 'fileName' : 'name']: destFileName,
                                        source: /** @type {Uint8Array | undefined} */ (source),
                                        originalFileName: getOriginalFileName(fileName, emitOriginalFileName),
                                    })
                                );
                            } else {
                                await mkdir(dirname(destFileName), { recursive: true });
                                await copyFile(fileName, destFileName, constants.COPYFILE_FICLONE);
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
                })
            );
            logger.finish(/** @type {string} */ (statisticsCollector()));
        },
    });
}

/**
 * @param {string} dir
 * @returns {string}
 */
function normalizeSlash(dir) {
    if (dir.endsWith('/')) {
        return `${dir.substring(0, dir.length - 1)}`;
    }
    return dir;
}

/**
 * @param {CopyPluginOptions} options
 * @param {string} field
 * @returns {SingleTargetDesc[]}
 */
function targets(options, field) {
    const optionsRecord = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (options));
    const rawTargets = /** @type {(string | SingleTargetDesc)[] | undefined} */ (optionsRecord[field]);
    const normalizedTargets = rawTargets ?? [/** @type {SingleTargetDesc} */ (/** @type {unknown} */ (options))];
    return /** @type {SingleTargetDesc[]} */ (
        normalizedTargets
            .map((/** @type {string | SingleTargetDesc} */ item) => {
                if (item) {
                    if (typeof item === 'string') {
                        return { src: item };
                    }
                    if (typeof item === 'object' && 'src' in item) {
                        return item;
                    }
                }
                return undefined;
            })
            .filter(Boolean)
    );
}

/**
 * @param {string} fileName
 * @param {NonTargetOptions['emitOriginalFileName']} emitOriginalFileName
 * @returns {string | undefined}
 */
function getOriginalFileName(fileName, emitOriginalFileName) {
    if (emitOriginalFileName === 'relative') {
        return fileName;
    }
    if (emitOriginalFileName === 'absolute') {
        return resolve(fileName);
    }
    if (typeof emitOriginalFileName === 'function') {
        return emitOriginalFileName(fileName);
    }
    return undefined;
}
