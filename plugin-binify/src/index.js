import { chmod } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * @import { NormalizedOutputOptions, OutputAsset, OutputBundle, OutputChunk, Plugin, PluginContext } from 'rollup'
 */

/**
 * @typedef {{ pluginName?: string, verbose?: boolean, shebang?: string, executableFlag?: number | string | false, filter?: (item: OutputAsset | OutputChunk) => boolean }} BinifyPluginOptions
 */

import { createLogger, LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { getOptionsObject } from '@rollup-extras/utils/options';

import { shebang } from './factories.js';
import { count } from './utils.js';

/** @typedef {ReturnType<typeof createLogger>} Logger */

const factories = { logger, shebang };

/**
 * @param {BinifyPluginOptions} [options]
 * @returns {Plugin}
 */
export default function (options = {}) {
    const { pluginName, filter, logger, verbose, shebang, executableFlag } = getOptionsObject(
        options,
        {
            pluginName: '@rollup-extras/plugin-binify',
            verbose: false,
            shebang: '#!/usr/bin/env node',
            executableFlag: process.platform === 'win32' ? false : 0o755,
            filter: (/** @type {OutputAsset | OutputChunk} */ item) => item.type === 'chunk' && /** @type {OutputChunk} */ (item).isEntry,
        },
        factories
    );

    let initialDir = '',
        /** @type {number} */ countFiles;

    return /** @type {Plugin} */ ({
        name: pluginName,
        /** @this {PluginContext} */
        renderStart(/** @type {NormalizedOutputOptions} */ outputOptions) {
            initialDir = outputOptions.dir || '';
            countFiles = 0;
            logger.start(`using ${initialDir} as output directory for ${pluginName}`, verbose ? LogLevel.info : LogLevel.verbose);
        },
        /** @this {PluginContext} */
        generateBundle(/** @type {NormalizedOutputOptions} */ _options, /** @type {OutputBundle} */ bundle) {
            for (const key in bundle) {
                const item = /** @type {OutputAsset | OutputChunk} */ (bundle[key]);
                if (filter(item)) {
                    ++countFiles;
                    if (item.type === 'chunk') {
                        if (item.map) {
                            item.map.mappings = ''.padEnd(count(shebang, '\n'), ';') + item.map.mappings;
                        }
                        item.code = shebang + item.code;
                    } else {
                        item.source = shebang + item.source;
                    }
                    logger.update(`${item.fileName} added shebang`);
                }
                if (typeof executableFlag !== 'number') {
                    logger.finish('added shebangs');
                }
            }
        },
        /** @this {PluginContext} */
        async writeBundle(/** @type {NormalizedOutputOptions} */ _options, /** @type {OutputBundle} */ bundle) {
            if (executableFlag !== false) {
                for (const key in bundle) {
                    const item = /** @type {OutputAsset | OutputChunk} */ (bundle[key]);
                    if (filter(item)) {
                        --countFiles;
                        const fileName = join(initialDir, item.fileName);
                        try {
                            await chmod(fileName, /** @type {number} */ (executableFlag));
                            logger.update(`${item.fileName} made executable`);
                        } catch (e) {
                            logger(`fs failed setting executable flag on ${fileName}`, LogLevel.error, e);
                        }
                        if (countFiles === 0) {
                            logger.finish('binify completed');
                        }
                    }
                }
            }
        },
    });
}
