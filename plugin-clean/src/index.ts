import fs from 'fs/promises';
import path from 'path';
import { PluginHooks, OutputOptions } from 'rollup';
import { CleanPluginOptions } from './types';
import { createLogger, LogLevel } from '@niceties/logger';

export default function({ targets, pluginName, runOnce }: CleanPluginOptions = {}) {
    const deleted = new Set<string>();

    pluginName ??= '@rollup-extras/plugin-clean';

    return <Partial<PluginHooks>>{
        name: pluginName,

        async renderStart(options: OutputOptions) {
            if (runOnce === undefined) {
                if (this.meta.watchMode) {
                    runOnce = true;
                }
            }
            if (!targets) {
                if (options.dir) {
                    await removeDir(options.dir);
                }
            } else {
                if (Array.isArray(targets)) {
                    await Promise.all(targets.map(removeDir));
                } else {
                    await removeDir(targets);
                }
            }
        }
    };

    async function removeDir(dir: string) {
        const normalizedDir = normalizeSlash(path.normalize(dir));
        if (deleted.has(normalizedDir)) {
            return;
        }
        deleted.add(normalizedDir);
        const logger = createLogger(pluginName);
        try {
            logger.start(`cleaning '${normalizedDir}'`, LogLevel.verbose);
            await fs.rm(normalizedDir, { recursive: true });
            logger.finish(`cleaned '${normalizedDir}'`);
        } catch (e: any) {
            const loglevel: number = e['code'] === 'ENOENT' ? LogLevel.verbose : LogLevel.warn;
            logger.finish(`failed cleaning '${normalizedDir}' \n ${e.stack}`, loglevel);
        }
    }
};

function normalizeSlash(dir: string): string {
    if (dir.endsWith('/')) {
        return `${dir.substring(0, dir.length - 1)}`;
    }
    return dir;
}
