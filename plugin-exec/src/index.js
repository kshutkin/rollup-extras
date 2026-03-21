/**
 * @import { Logger } from '@niceties/logger'
 * @import { PluginContext } from 'rollup'
 */

/**
 * @typedef {(this: PluginContext & { logger: Logger }) => void} CallbackFunction
 */

/**
 * @typedef {{ pluginName?: string, exec?: CallbackFunction }} ExecPluginOptionsObject
 */

/**
 * @typedef {ExecPluginOptionsObject | CallbackFunction} ExecPluginOptions
 */

import logger from '@rollup-extras/utils/logger';
import { multiConfigPluginBase } from '@rollup-extras/utils/multi-config-plugin-base';
import { getOptionsObject } from '@rollup-extras/utils/options';

const factories = { logger };

/**
 * @param {ExecPluginOptions} options
 */
export default function (options) {
    const normalizedOptions = getOptionsObject(
        typeof options === 'function' ? { exec: options } : options,
        {
            pluginName: '@rollup-extras/plugin-exec',
            exec: () => undefined,
        },
        factories
    );
    const { pluginName, logger, exec } = normalizedOptions;
    const instance = multiConfigPluginBase(true, pluginName, execute);

    let started = false;

    return instance;

    /** @this {PluginContext} */
    async function execute() {
        if (!started) {
            started = true;

            const newContext = Object.create(this);

            newContext.logger = logger;

            exec.apply(newContext);
        }
    }
}
