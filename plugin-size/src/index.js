/**
 * @import { Plugin, NormalizedOutputOptions, OutputBundle, OutputChunk, OutputAsset } from 'rollup'
 */

import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { gzip as gzipCb } from 'node:zlib';

import { minify } from 'oxc-minify';

import { bold, cyan, dim, green, red, yellow } from '@niceties/ansi';
import logger from '@rollup-extras/utils/logger';
import { multiConfigPluginBase } from '@rollup-extras/utils/multi-config-plugin-base';
import { getOptionsObject } from '@rollup-extras/utils/options';

const gzip = promisify(gzipCb);

/**
 * @typedef {{ pluginName?: string, statsFile?: string, updateStats?: boolean }} SizePluginOptions
 */

/**
 * @typedef {{ raw: number, minified: number, compressed: number }} ChunkSizeStats
 */

/**
 * @typedef {{ raw: number, compressed: number }} AssetSizeStats
 */

/**
 * @typedef {{ entries?: Record<string, ChunkSizeStats>, chunks?: Record<string, ChunkSizeStats>, assets?: Record<string, AssetSizeStats> }} StatsData
 */

const factories = { logger };

/**
 * Format bytes to a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} kB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format the delta between current and previous compressed size.
 * @param {number} current
 * @param {number | undefined} previous
 * @returns {string}
 */
function formatDelta(current, previous) {
    if (previous == null) return '';
    const delta = current - previous;
    if (delta === 0) return dim(' (=)');
    if (delta > 0) return red(` (+${formatSize(delta)})`);
    return green(` (-${formatSize(Math.abs(delta))})`);
}

/**
 * Collect all keys from both objects, sorted alphabetically.
 * @param {Record<string, unknown>} [a]
 * @param {Record<string, unknown>} [b]
 * @returns {string[]}
 */
function allKeys(a, b) {
    const set = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    return [...set].sort();
}

/**
 * Print the size report comparing current and previous stats.
 * @param {StatsData} current
 * @param {StatsData} previous
 * @param {(message: string) => void} log
 */
function printReport(current, previous, log) {
    const entryKeys = allKeys(current.entries, previous.entries);
    const chunkKeys = allKeys(current.chunks, previous.chunks);
    const assetKeys = allKeys(current.assets, previous.assets);

    if (entryKeys.length === 0 && chunkKeys.length === 0 && assetKeys.length === 0) {
        return;
    }

    for (const format of entryKeys) {
        const cur = current.entries?.[format];
        const prev = previous.entries?.[format];
        if (cur) {
            log(
                `${bold(cyan(format))} entry: ${formatSize(cur.raw)} → ${formatSize(cur.minified)} → ${bold(formatSize(cur.compressed))} gzip${formatDelta(cur.compressed, prev?.compressed)}`
            );
        } else {
            log(`${bold(cyan(format))} entry: ${dim('removed')}`);
        }
    }

    for (const format of chunkKeys) {
        const cur = current.chunks?.[format];
        const prev = previous.chunks?.[format];
        if (cur) {
            log(
                `${bold(cyan(format))} chunks: ${formatSize(cur.raw)} → ${formatSize(cur.minified)} → ${bold(formatSize(cur.compressed))} gzip${formatDelta(cur.compressed, prev?.compressed)}`
            );
        } else {
            log(`${bold(cyan(format))} chunks: ${dim('removed')}`);
        }
    }

    for (const ext of assetKeys) {
        const cur = current.assets?.[ext];
        const prev = previous.assets?.[ext];
        if (cur) {
            log(
                `${bold(yellow(ext))} assets: ${formatSize(cur.raw)} → ${bold(formatSize(cur.compressed))} gzip${formatDelta(cur.compressed, prev?.compressed)}`
            );
        } else {
            log(`${bold(yellow(ext))} assets: ${dim('removed')}`);
        }
    }
}

/**
 * Process a single output bundle and accumulate sizes into currentStats.
 * @param {StatsData} currentStats
 * @param {NormalizedOutputOptions} outputOptions
 * @param {OutputBundle} bundle
 */
async function collectStats(currentStats, outputOptions, bundle) {
    const format = outputOptions.format;

    await Promise.all(
        Object.entries(bundle).map(async ([fileName, item]) => {
            if (item.type === 'chunk') {
                const code = /** @type {OutputChunk} */ (item).code;
                const raw = Buffer.byteLength(code, 'utf8');

                const minResult = await minify(fileName, code, {
                    compress: { target: 'esnext' },
                    mangle: { toplevel: true },
                    codegen: { removeWhitespace: true },
                });
                const minifiedSize = Buffer.byteLength(minResult.code, 'utf8');
                const compressed = await gzip(Buffer.from(minResult.code, 'utf8'));
                const compressedSize = compressed.byteLength;

                const category = /** @type {OutputChunk} */ (item).isEntry ? 'entries' : 'chunks';
                if (!currentStats[category]) {
                    currentStats[category] = {};
                }
                const bucket = /** @type {Record<string, ChunkSizeStats>} */ (currentStats[category]);
                if (!bucket[format]) {
                    bucket[format] = { raw: 0, minified: 0, compressed: 0 };
                }
                bucket[format].raw += raw;
                bucket[format].minified += minifiedSize;
                bucket[format].compressed += compressedSize;
            } else {
                const source = /** @type {OutputAsset} */ (item).source;
                const raw = typeof source === 'string' ? Buffer.byteLength(source, 'utf8') : source.byteLength;
                const ext = extname(fileName) || fileName;
                const buf = typeof source === 'string' ? Buffer.from(source, 'utf8') : Buffer.from(source);
                const compressed = await gzip(buf);
                const compressedSize = compressed.byteLength;

                if (!currentStats.assets) {
                    currentStats.assets = {};
                }
                if (!currentStats.assets[ext]) {
                    currentStats.assets[ext] = { raw: 0, compressed: 0 };
                }
                currentStats.assets[ext].raw += raw;
                currentStats.assets[ext].compressed += compressedSize;
            }
        })
    );
}

/**
 * Read and parse a JSON stats file, returning an empty object on any failure.
 * @param {string} statsPath
 * @returns {Promise<StatsData>}
 */
async function loadPreviousStats(statsPath) {
    try {
        const content = await readFile(statsPath, 'utf8');
        return JSON.parse(content);
    } catch {
        return {};
    }
}

/**
 * Rollup plugin that reports the size of generated artifacts.
 *
 * Chunks are minified with oxc-minify and then gzip-compressed to produce the
 * reported sizes. Assets are gzip-compressed only. Results are compared against
 * a persisted JSON stats file so that size regressions are easy to spot.
 *
 * @param {SizePluginOptions} [options]
 * @returns {Plugin & { api: { addInstance(): Plugin } }}
 */
export default function (options) {
    const normalizedOptions = getOptionsObject(
        options ?? {},
        {
            pluginName: '@rollup-extras/plugin-size',
            statsFile: '.stats.json',
            updateStats: true,
        },
        factories
    );

    const { pluginName, statsFile, updateStats, logger } = normalizedOptions;

    /** @type {StatsData} */
    const currentStats = {};

    const instance = multiConfigPluginBase(false, pluginName, reportAndSave, onEachOutput);

    return instance;

    /**
     * Called on every generateBundle invocation (once per output config).
     * @param {NormalizedOutputOptions} outputOptions
     * @param {OutputBundle} bundle
     */
    async function onEachOutput(outputOptions, bundle) {
        await collectStats(currentStats, outputOptions, bundle);
    }

    /**
     * Called once when all configs and outputs have been processed.
     */
    async function reportAndSave() {
        const statsPath = resolve(process.cwd(), statsFile);

        const previousStats = await loadPreviousStats(statsPath);

        printReport(currentStats, previousStats, logger);

        if (updateStats) {
            await writeFile(statsPath, `${JSON.stringify(currentStats, null, 2)}\n`);
        }
    }
}
