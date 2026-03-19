import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @import { NormalizedInputOptions, NormalizedOutputOptions, Plugin, PluginContext, RollupOptions } from 'rollup'
 */

/**
 * @typedef {{ targets?: string | string[], pluginName?: string, deleteOnce?: boolean, outputPlugin?: boolean, verbose?: boolean }} CleanPluginOptionsObject
 */

/**
 * @typedef {CleanPluginOptionsObject | string | string[]} CleanPluginOptions
 */

import { createLogger, LogLevel } from '@niceties/logger';
import { multiConfigPluginBase } from '@rollup-extras/utils/multi-config-plugin-base';
import { getOptions } from '@rollup-extras/utils/options';

/**
 * @param {CleanPluginOptions} [options]
 * @returns {Plugin}
 */
export default function (options = {}) {
    /** @type {Map<string, Promise<void>>} */
    const inProgress = new Map();
    /** @type {Map<string, Promise<void>>} */
    const hasChildrenInProgress = new Map();
    let deleted = false;

    const normalizedOptions = getOptions(
        options,
        {
            pluginName: '@rollup-extras/plugin-clean',
            deleteOnce: true,
            verbose: false,
            outputPlugin: true,
        },
        'targets'
    );
    const { pluginName, deleteOnce, verbose, outputPlugin } = normalizedOptions;
    let { targets } = normalizedOptions;

    const instance = multiConfigPluginBase(false, pluginName, cleanup);
    const baseAddInstance = /** @type {() => Plugin} */ (instance.api.addInstance);
    const baseRenderStart =
        /** @type {(this: PluginContext, outputOptions: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) => void | Promise<void>} */ (
            /** @type {Required<typeof instance>} */ (instance).renderStart
        );

    if (outputPlugin) {
        /** @this {PluginContext} */
        instance.renderStart = async function (
            /** @type {NormalizedOutputOptions} */ outputOptions,
            /** @type {NormalizedInputOptions} */ inputOptions
        ) {
            baseRenderStart.call(this, outputOptions, inputOptions);
            await renderStart(outputOptions);
        };
    } else {
        instance.buildStart = buildStart;
        instance.options = optionsHook;
    }

    instance.api.addInstance = () => {
        const instance = baseAddInstance();
        const baseRenderStart =
            /** @type {(this: PluginContext, outputOptions: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) => void | Promise<void>} */ (
                /** @type {Required<typeof instance>} */ (instance).renderStart
            );

        if (outputPlugin) {
            /** @this {PluginContext} */
            instance.renderStart = async function (
                /** @type {NormalizedOutputOptions} */ outputOptions,
                /** @type {NormalizedInputOptions} */ inputOptions
            ) {
                baseRenderStart.call(this, outputOptions, inputOptions);
                await renderStart(outputOptions);
            };
        } else {
            instance.buildStart = buildStart;
            instance.options = optionsHook;
        }

        return instance;
    };

    return instance;

    /**
     * @param {RollupOptions} config
     */
    async function optionsHook(config) {
        if (!targets && config) {
            targets = /** @type {string[]} */ (
                (Array.isArray(config.output) ? config.output.map(item => item.dir) : [config.output?.dir]).filter(Boolean)
            );
        }
        return null;
    }

    async function buildStart() {
        if (deleted) {
            return;
        }
        if (targets) {
            await Promise.all(targets.map(removeDir));
        }
    }

    /**
     * @param {NormalizedOutputOptions} options
     */
    async function renderStart(options) {
        if (deleted) {
            return;
        }
        if (!targets) {
            if (options.dir) {
                await removeDir(options.dir);
            }
        } else {
            await Promise.all(targets.map(removeDir));
        }
    }

    /**
     * @param {string} dir
     */
    async function removeDir(dir) {
        const normalizedDir = normalizeSlash(path.normalize(dir));
        if (inProgress.has(normalizedDir)) {
            return outputPlugin && inProgress.get(normalizedDir);
        }
        /** @type {Promise<void>} */
        let removePromise;
        /** @type {string[]} */
        let parentsInProgress;
        if (hasChildrenInProgress.has(dir)) {
            removePromise = Promise.resolve(hasChildrenInProgress.get(dir)).then(() => doRemove(normalizedDir));
        } else {
            parentsInProgress = Array.from(parentDirs(dir)).filter(item => inProgress.has(item));
            if (parentsInProgress.length > 0) {
                return inProgress.get(/** @type {string} */ (parentsInProgress[0]));
            }
            removePromise = doRemove(normalizedDir);
        }
        inProgress.set(normalizedDir, removePromise);
        for (const parentDir of parentDirs(dir)) {
            if (!hasChildrenInProgress.has(parentDir)) {
                hasChildrenInProgress.set(parentDir, removePromise);
            } else {
                hasChildrenInProgress.set(
                    parentDir,
                    /** @type {Promise<void>} */ (
                        /** @type {unknown} */ (Promise.all([removePromise, hasChildrenInProgress.get(parentDir)]))
                    )
                );
            }
        }
        return removePromise;
    }

    /**
     * @param {string} normalizedDir
     */
    async function doRemove(normalizedDir) {
        const logger = createLogger(pluginName);
        try {
            logger.start(`cleaning '${normalizedDir}'`, verbose ? LogLevel.info : LogLevel.verbose);
            await fs.rm(normalizedDir, { recursive: true });
            logger.finish(`cleaned '${normalizedDir}'`);
        } catch (/** @type {any} */ e) {
            const loglevel = /** @type {{ code: string }} */ (e).code === 'ENOENT' ? undefined : LogLevel.warn;
            logger.finish(`failed cleaning '${normalizedDir}'`, loglevel, e);
        }
    }

    function cleanup() {
        inProgress.clear();
        hasChildrenInProgress.clear();
        deleted = deleteOnce;
    }
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
 * @param {string} dir
 * @yields {string}
 */
function* parentDirs(dir) {
    for (;;) {
        dir = path.dirname(dir);
        if (dir === '.' || dir === '/') {
            break;
        }
        yield dir;
    }
}
