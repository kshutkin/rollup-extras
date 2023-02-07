import fs from 'node:fs/promises';
import path from 'path';
import { NormalizedOutputOptions, OutputAsset, OutputBundle, OutputChunk, Plugin, PluginContext } from 'rollup';
import { BinifyPluginOptions } from './types';
import { getOptionsObject } from '@rollup-extras/utils/options';
import { createLogger, LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { shebang } from './factories';
import { count } from './utils';

type Logger = ReturnType<typeof createLogger>;

const factories = { logger, shebang } as unknown as { logger: () => Logger, shebang: () => string };

export default function(options: BinifyPluginOptions = {}) {
    const { pluginName, filter, logger, verbose, shebang, executableFlag } = getOptionsObject(options, {
        pluginName: '@rollup-extras/plugin-binify',
        verbose: false,
        shebang: '#!/usr/bin/env node',
        executableFlag: process.platform === 'win32' ? false : 0o755,
        filter: (item: OutputAsset | OutputChunk) => item.type === 'chunk' && item.isEntry
    }, factories);

    let initialDir = '', countFiles: number;

    return <Plugin>{
        name: pluginName,
        renderStart(this: PluginContext, outputOptions: NormalizedOutputOptions) {
            initialDir = outputOptions.dir || '';
            countFiles = 0;
            logger.start(`using ${initialDir} as output directory for ${pluginName}`, verbose ? LogLevel.info : LogLevel.verbose);
        },
        generateBundle(this: PluginContext, _options: NormalizedOutputOptions, bundle: OutputBundle) {
            for (const key in bundle) {
                const item: OutputAsset | OutputChunk = bundle[key];
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
        async writeBundle(this: PluginContext, _options: NormalizedOutputOptions, bundle: OutputBundle) {
            if (executableFlag !== false) {
                for (const key in bundle) {
                    const item: OutputAsset | OutputChunk = bundle[key];
                    if (filter(item)) {
                        --countFiles;
                        const fileName = path.join(initialDir, item.fileName);
                        try {
                            await fs.chmod(fileName, executableFlag);
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
        }
    };
}
