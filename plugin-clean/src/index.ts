import fs from 'fs/promises';
import path from 'path';
import { PluginHooks, OutputOptions, RollupOptions } from 'rollup';
import { CleanPluginOptions } from './types';
import { createLogger, LogLevel } from '@niceties/logger';
import { getOptions } from '@rollup-extras/utils/options';

export default function(options: CleanPluginOptions = {}) {
    const deleted = new Map<string, Promise<void>>();

    const normalizedOptions = getOptions(options, {
        pluginName: '@rollup-extras/plugin-clean',
        deleteOnce: true,
        verbose: false,
        outputPlugin: true
    }, 'targets');
    const { pluginName, deleteOnce, verbose, outputPlugin } = normalizedOptions;
    let { targets } = normalizedOptions;

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
            return outputPlugin && deleted.get(normalizedDir);
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
            logger.finish(`failed cleaning '${normalizedDir}'`, loglevel, e);
        }
    }
}

function normalizeSlash(dir: string): string {
    if (dir.endsWith('/')) {
        return `${dir.substring(0, dir.length - 1)}`;
    }
    return dir;
}
