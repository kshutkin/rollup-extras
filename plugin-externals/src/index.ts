import path from 'path';
import { Plugin, PluginContext } from 'rollup';
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

    return <Plugin>{
        name: pluginName,
        resolveId(this: PluginContext, id: string) {
            let isExternal = id.includes('node_modules') || isBuiltinModule(id) || path.relative('.', id).startsWith('..');
            if (external) {
                isExternal = external(id, isExternal);
            }
            logger(`'${id}' is ${isExternal ? '' : 'not '}external`, logLevel);
            return isExternal ? false : null;
        }
    };
}