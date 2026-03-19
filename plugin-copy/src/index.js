import fs_ from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { glob } from 'glob';
import globParent from 'glob-parent';

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
 * @typedef {{ targets?: MultipleTargetsDesc, pluginName?: string, copyOnce?: boolean, watch?: boolean, verbose?: boolean | 'list-filenames', flatten?: boolean, exactFileNames?: boolean, outputPlugin?: boolean, emitFiles?: boolean, emitOriginalFileName?: 'absolute' | 'relative' | ((fileName: string) => string) }} NonTargetOptions
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

const factories = /** @type {any} */ ({ targets, logger });

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
        },
        'targets',
        factories
    );

    const { pluginName, copyOnce, verbose, exactFileNames, targets, outputPlugin, flatten, emitFiles, logger, emitOriginalFileName } =
        normalizedOptions;
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
                        glob(target.src, { ignore: target.exclude }).then(result => ({
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
                    const dest = flatten
                        ? normalizeSlash(result.dest)
                        : path.join(result.dest, path.relative(result.parent, path.dirname(file)));
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
                    try {
                        const fileStat = await fs.stat(fileName);
                        if (!fileStat.isFile()) {
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
                    } catch (/** @type {any} */ e) {
                        const loglevel = /** @type {{ code: string }} */ (e).code === 'ENOENT' ? undefined : LogLevel.warn;
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
                                /** @type {PluginContext} */ (/** @type {unknown} */ (this)).emitFile(
                                    /** @type {EmittedFile} */ ({
                                        type: 'asset',
                                        [exactFileNames ? 'fileName' : 'name']: destFileName,
                                        source: /** @type {Uint8Array | undefined} */ (source),
                                        originalFileName: getOriginalFileName(fileName, emitOriginalFileName),
                                    })
                                );
                            } else {
                                await fs.mkdir(path.dirname(destFileName), { recursive: true });
                                await fs.copyFile(fileName, destFileName, fs_.constants.COPYFILE_FICLONE);
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
    let targets = /** @type {any} */ (options)[field];
    if (targets == null) {
        targets = [options];
    }
    if (Array.isArray(targets)) {
        targets = targets
            .map((/** @type {any} */ item) => {
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
            .filter(Boolean);
    }
    return targets;
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
        return path.resolve(fileName);
    }
    if (typeof emitOriginalFileName === 'function') {
        return emitOriginalFileName(fileName);
    }
    return undefined;
}
