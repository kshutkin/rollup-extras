import fs from 'fs/promises';
import path from 'path';
import { PluginHooks, OutputOptions, RollupOptions } from 'rollup';
import { CleanPluginOptions } from './types';
import { createLogger, LogLevel } from '@niceties/logger';
import { getOptions } from '@rollup-extras/utils/options';

export default function(options: CleanPluginOptions = {}) {
    const inProgress = new Map<string, Promise<void>>();
    const hasChildrenInProgress = new Map<string, Promise<void>>();
    let deleted = false;

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

    pluginInstance.generateBundle = cleanup;

    return pluginInstance;

    async function optionsHook(config: RollupOptions) {
        if (!targets && config) {
            targets = (Array.isArray(config.output) ? config.output.map(item => item.dir) : [config.output?.dir])
                .filter(Boolean) as string[];
        }
        return null;
    }

    async function buildStart() {
        if (deleted) {
            return;
        }
        if (targets) {
            await Promise.all(targets.map(removeDir));
        }
    }

    async function renderStart(options: OutputOptions) {
        if (deleted) {
            return;
        }
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
        if (inProgress.has(normalizedDir)) {
            return outputPlugin && inProgress.get(normalizedDir);
        }
        const removePromise = doRemove(normalizedDir);
        inProgress.set(normalizedDir, removePromise);
        for(const parentDir of parentDirs(dir)) {
            if (!hasChildrenInProgress.has(parentDir)) {
                hasChildrenInProgress.set(parentDir, removePromise);
            } else {
                hasChildrenInProgress.set(parentDir, Promise.all([removePromise, hasChildrenInProgress.get(parentDir)]) as never as Promise<void>);
            }
        }
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

    function cleanup() {
        inProgress.clear();
        hasChildrenInProgress.clear();
        deleted = deleteOnce;
    }
}

function normalizeSlash(dir: string): string {
    if (dir.endsWith('/')) {
        return `${dir.substring(0, dir.length - 1)}`;
    }
    return dir;
}

function *parentDirs(dir: string) {
    while(((dir = path.dirname(dir)) !== '.') && (dir !== '/')) {
        yield dir;
    }
}
