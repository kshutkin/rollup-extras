import { PluginContext } from 'rollup';
import { getOptionsObject } from '@rollup-extras/utils/options';
import logger from '@rollup-extras/utils/logger';
import { multiConfigPluginBase } from '@rollup-extras/utils/mutli-config-plugin-base';
import { ExecPluginOptions } from './types';

const factories = { logger };

export default function(options: ExecPluginOptions) {
    const normalizedOptions = getOptionsObject(typeof options === 'function' ? { exec: options } : options, {
        pluginName: '@rollup-extras/plugin-exec',
        exec: () => undefined
    }, factories);
    const { pluginName, logger, exec } = normalizedOptions;
    const instance = multiConfigPluginBase(true, pluginName, execute);
    
    let started = false;

    return instance;

    async function execute(this: PluginContext) {
        if (!started) {
            started = true;

            const newContext = Object.create(this);

            newContext.logger = logger;

            exec.apply(newContext);
        }
    }
}
