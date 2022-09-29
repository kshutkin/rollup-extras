import { PluginContext, PluginHooks } from 'rollup';
import isBuiltinModule from 'is-builtin-module';
import { getOptionsObject } from '@rollup-extras/utils/options';
import { LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { ExternalsPluginOptions } from './types';

const factories = { logger };

export default function(options: ExternalsPluginOptions = {}) {
    const { pluginName, external, logger, verbose } = getOptionsObject(options, {
        pluginName: '@rollup-extras/plugin-externals',
        verbose: false
    }, factories);

    const logLevel = verbose ? LogLevel.info : LogLevel.verbose;

    return <Partial<PluginHooks>>{
        name: pluginName,
        resolveId(this: PluginContext, id: string) {
            let isExternal = id.indexOf('node_modules') >= 0 || isBuiltinModule(id);
            if (external) {
                isExternal = external(id, isExternal);
            }
            logger(`'${id}' is ${isExternal ? '' : 'not '}external`, logLevel);
            return isExternal ? false : null;
        }
    };
}