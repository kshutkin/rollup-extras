import fs from 'fs/promises';
import path from 'path';
import { PluginHooks, OutputOptions, RollupOptions } from 'rollup';
import { CleanPluginOptions } from './types';
import { createLogger, LogLevel } from '@niceties/logger';

export default function(options: CleanPluginOptions = {}) {
    const deleted = new Map<string, Promise<void>>();

    const normailizedOptions = normalizeOptions(options);
    const { pluginName, deleteOnce, verbose, outputPlugin } = normailizedOptions;
    let { targets } = normailizedOptions;

    const pluginInstance = {
        name: pluginName
    } as Partial<PluginHooks>;

    if (outputPlugin) {
        pluginInstance.renderStart = renderStart;
    } else {
        pluginInstance.buildStart = buildStart;
        pluginInstance.options = optionsHook;
    }

    return pluginInstance;

    async function optionsHook(config: RollupOptions) {
        if (!targets && config) {
            targets = (Array.isArray(config.output) ? config.output.map(item => item.dir) : [config.output?.dir])
                .filter(Boolean) as string[];
        }
        return null;
    }

    async function buildStart() {
        if (targets) {
            await Promise.all(targets.map(removeDir));
        }
    }

    async function renderStart(options: OutputOptions) {
        if (!targets) {
            if (options.dir) {
                await removeDir(options.dir);
            }
        } else {
            await Promise.all(targets.map(removeDir));
        }
    }

    async function removeDir(dir: string) {
        const normalizedDir = normalizeSlash(path.normalize(dir));
        if (deleteOnce && deleted.has(normalizedDir)) {
            return deleted.get(normalizedDir);
        }
        const removePromise = doRemove(normalizedDir);
        deleted.set(normalizedDir, removePromise);
        return removePromise;
    }

    async function doRemove(normalizedDir: string) {
        const logger = createLogger(pluginName);
        try {
            logger.start(`cleaning '${normalizedDir}'`, verbose ? LogLevel.info : LogLevel.verbose);
            await fs.rm(normalizedDir, { recursive: true });
            logger.finish(`cleaned '${normalizedDir}'`);
        } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            const loglevel: number | undefined = e['code'] === 'ENOENT' ? undefined : LogLevel.warn;
            logger.finish(`failed cleaning '${normalizedDir}'\n${e.stack}`, loglevel);
        }
    }
}

function normalizeSlash(dir: string): string {
    if (dir.endsWith('/')) {
        return `${dir.substring(0, dir.length - 1)}`;
    }
    return dir;
}

type NormilizedOptions = {
    targets?: string[],
    pluginName: string,
    deleteOnce: boolean,
    outputPlugin: boolean,
    verbose: boolean
}

function normalizeOptions(userOptions: CleanPluginOptions): NormilizedOptions {
    const options = {
        pluginName: (userOptions as NormilizedOptions).pluginName ?? '@rollup-extras/plugin-clean',
        deleteOnce: (userOptions as NormilizedOptions).deleteOnce ?? true,
        verbose: (userOptions as NormilizedOptions).verbose ?? false,
        outputPlugin: (userOptions as NormilizedOptions).outputPlugin ?? true,
        targets: getTargets(userOptions)
    };

    return options;
}

function getTargets(userOptions: CleanPluginOptions): string[] | undefined {
    if (typeof userOptions === 'string') {
        return [userOptions];
    }
    if (Array.isArray(userOptions)) {
        return userOptions;
    }
    if (typeof userOptions === 'object') {
        return 'targets' in userOptions ? getTargets(userOptions.targets as string | string[]) : undefined;
    }
    return [];
}
