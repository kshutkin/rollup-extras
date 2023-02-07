import path from 'node:path';
import { Plugin, PluginContext } from 'rollup';
import isBuiltinModule from 'is-builtin-module';
import { getOptionsObject } from '@rollup-extras/utils/options';
import { LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { ExternalsPluginOptions } from './types';
import packageDirectory from 'pkg-dir';

const factories = { logger };

export default function(options: ExternalsPluginOptions = {}) {
    const { pluginName, external, logger, verbose } = getOptionsObject(options, {
        pluginName: '@rollup-extras/plugin-externals',
        verbose: false
    }, factories);

    const logLevel = verbose ? LogLevel.info : LogLevel.verbose;
    let pkgDir: string | false = false;

    return <Plugin>{
        name: pluginName,
        async resolveId(this: PluginContext, id: string, importer: string) {
            if (pkgDir === false) {
                pkgDir = (await packageDirectory()) ?? '.';
            }
            const importingFileName = path.resolve(path.dirname(importer || ''), id);
            let isExternal = id.includes('node_modules') || isBuiltinModule(id) || path.relative(pkgDir, importingFileName).startsWith('..');
            if (external) {
                isExternal = external(id, isExternal, importer);
            }
            logger(`'${id}' is ${isExternal ? '' : 'not '}external`, logLevel);
            return isExternal ? false : null;
        }
    };
}