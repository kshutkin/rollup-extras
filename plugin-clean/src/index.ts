import fs from 'fs/promises';
import path from 'path';
import { NormalizedInputOptions, NormalizedOutputOptions, PluginContext, PluginHooks, RollupOptions } from 'rollup';
import { CleanPluginOptions } from './types';
import { createLogger, LogLevel } from '@niceties/logger';
import { getOptions } from '@rollup-extras/utils/options';
import { multiConfigPluginBase } from '@rollup-extras/utils/mutli-config-plugin-base';

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

    const instance = multiConfigPluginBase(false, pluginName, cleanup);
    const baseAddInstance = (instance as Required<typeof instance>).api.addInstance;
    const baseRenderStart = (instance as Required<typeof instance>).renderStart;

    if (outputPlugin) {
        instance.renderStart = async function (options: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) {
            (baseRenderStart as (this: PluginContext, outputOptions: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) => void | Promise<void>).call(this, options, inputOptions);
            await renderStart(options);
        };
    } else {
        instance.buildStart = buildStart;
        instance.options = optionsHook;
    }

    instance.api.addInstance = () => {
        const instance = baseAddInstance() as never as PluginHooks;
        const baseRenderStart = (instance as Required<typeof instance>).renderStart;

        if (outputPlugin) {
            instance.renderStart = async function (options: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) {
                (baseRenderStart as (this: PluginContext, outputOptions: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) => void | Promise<void>).call(this, options, inputOptions);
                await renderStart(options);
            };
        } else {
            instance.buildStart = buildStart;
            instance.options = optionsHook;
        }
    
        return instance;
    };

    return instance;

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

    async function renderStart(options: NormalizedOutputOptions) {
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
        let removePromise: Promise<void>;
        let parentsInProgress: string[];
        if (hasChildrenInProgress.has(dir)) {
            removePromise = Promise.resolve(hasChildrenInProgress.get(dir))
                .then(() => doRemove(normalizedDir));
        } else if ((parentsInProgress = Array.from(parentDirs(dir)).filter(item => inProgress.has(item))).length > 0) {
            return inProgress.get(parentsInProgress[0]);
        } else {
            removePromise = doRemove(normalizedDir);
        }
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
