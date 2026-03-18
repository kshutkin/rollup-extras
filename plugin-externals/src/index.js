import path from 'node:path';

/**
 * @import { Plugin, PluginContext } from 'rollup'
 */

/**
 * @typedef {{ pluginName?: string, verbose?: boolean, external?: (id: string, external: boolean, importer?: string) => boolean }} ExternalsPluginOptionsObject
 */

/**
 * @typedef {ExternalsPluginOptionsObject | ((id: string, external: boolean, importer?: string) => boolean)} ExternalsPluginOptions
 */

import isBuiltinModule from 'is-builtin-module';
import packageDirectory from 'pkg-dir';

import { LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { getOptionsObject } from '@rollup-extras/utils/options';

const factories = { logger };

/**
 * @param {ExternalsPluginOptions} [options]
 * @returns {Plugin}
 */
export default function (options = {}) {
    if (typeof options === 'function') {
        options = { external: options };
    }
    const { pluginName, external, logger, verbose } = getOptionsObject(
        options,
        {
            pluginName: '@rollup-extras/plugin-externals',
            verbose: false,
        },
        factories
    );

    const logLevel = verbose ? LogLevel.info : LogLevel.verbose;
    /** @type {string | false} */
    let pkgDir = false;

    return /** @type {Plugin} */ ({
        name: pluginName,
        /** @this {PluginContext} */
        async resolveId(/** @type {string} */ id, /** @type {string} */ importer) {
            if (pkgDir === false) {
                pkgDir = (await packageDirectory()) ?? '.';
            }
            const importingFileName = path.resolve(path.dirname(importer || ''), id);
            let isExternal =
                id.includes('node_modules') || isBuiltinModule(id) || path.relative(pkgDir, importingFileName).startsWith('..');
            if (external) {
                isExternal = external(id, isExternal, importer);
            }
            logger(`'${id}' is ${isExternal ? '' : 'not '}external`, logLevel);
            return isExternal ? false : null;
        },
    });
}
