/**
 * @import { Plugin, NormalizedOutputOptions, OutputBundle, OutputChunk, OutputAsset } from 'rollup'
 */

import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress as brotliCb, gzip as gzipCb } from 'node:zlib';

import { bold, cyan, dim, green, red, yellow } from '@niceties/ansi';
import logger from '@rollup-extras/utils/logger';
import { multiConfigPluginBase } from '@rollup-extras/utils/multi-config-plugin-base';
import { getOptionsObject } from '@rollup-extras/utils/options';

const gzip = promisify(gzipCb);
const brotli = promisify(brotliCb);

/**
 * @typedef {{ pluginName?: string, statsFile?: string, updateStats?: boolean, gzip?: boolean, brotli?: boolean, minify?: (code: string, fileName: string) => Promise<string> }} SizePluginOptions
 */

/**
 * @typedef {{ raw: number, minified?: number, gzip?: number, brotli?: number }} ChunkSizeStats
 */

/**
 * @typedef {{ raw: number, gzip?: number, brotli?: number }} AssetSizeStats
 */

/**
 * @typedef {{ entries?: Record<string, ChunkSizeStats>, chunks?: Record<string, ChunkSizeStats>, assets?: Record<string, AssetSizeStats> }} StatsData
 */

/**
 * @typedef {{ gzip: boolean, brotli: boolean }} CompressionFlags
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
 * Format the delta between current and previous size for one algorithm.
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
 * Build the compressed-size segment of a report line.
 * Shows each enabled algorithm that has data in the current stats, with deltas
 * from the previous stats when available.
 *
 * @param {{ gzip?: number, brotli?: number }} cur
 * @param {{ gzip?: number, brotli?: number }} [prev]
 * @returns {string}
 */
function formatCompressed(cur, prev) {
    const parts = [];
    if (cur.gzip != null) {
        parts.push(`${bold(formatSize(cur.gzip))} gzip${formatDelta(cur.gzip, prev?.gzip)}`);
    }
    if (cur.brotli != null) {
        parts.push(`${bold(formatSize(cur.brotli))} brotli${formatDelta(cur.brotli, prev?.brotli)}`);
    }
    if (parts.length === 0) return '';
    return ` → ${parts.join(' / ')}`;
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
            const minPart = cur.minified != null ? ` → ${formatSize(cur.minified)}` : '';
            log(`${bold(cyan(format))} entry: ${formatSize(cur.raw)}${minPart}${formatCompressed(cur, prev)}`);
        } else {
            log(`${bold(cyan(format))} entry: ${dim('removed')}`);
        }
    }

    for (const format of chunkKeys) {
        const cur = current.chunks?.[format];
        const prev = previous.chunks?.[format];
        if (cur) {
            const minPart = cur.minified != null ? ` → ${formatSize(cur.minified)}` : '';
            log(`${bold(cyan(format))} chunks: ${formatSize(cur.raw)}${minPart}${formatCompressed(cur, prev)}`);
        } else {
            log(`${bold(cyan(format))} chunks: ${dim('removed')}`);
        }
    }

    for (const ext of assetKeys) {
        const cur = current.assets?.[ext];
        const prev = previous.assets?.[ext];
        if (cur) {
            log(`${bold(yellow(ext))} assets: ${formatSize(cur.raw)}${formatCompressed(cur, prev)}`);
        } else {
            log(`${bold(yellow(ext))} assets: ${dim('removed')}`);
        }
    }
}

/**
 * Compress a buffer with all enabled algorithms and return the sizes.
 * @param {Buffer} buf
 * @param {CompressionFlags} flags
 * @returns {Promise<{ gzip?: number, brotli?: number }>}
 */
async function compressSizes(buf, flags) {
    /** @type {{ gzip?: number, brotli?: number }} */
    const result = {};

    const tasks = [];

    if (flags.gzip) {
        tasks.push(
            gzip(buf).then(compressed => {
                result.gzip = compressed.byteLength;
            })
        );
    }
    if (flags.brotli) {
        tasks.push(
            brotli(buf).then(compressed => {
                result.brotli = compressed.byteLength;
            })
        );
    }

    await Promise.all(tasks);
    return result;
}

/**
 * Process a single output bundle and accumulate sizes into currentStats.
 * @param {StatsData} currentStats
 * @param {NormalizedOutputOptions} outputOptions
 * @param {OutputBundle} bundle
 * @param {CompressionFlags} flags
 * @param {((code: string, fileName: string) => Promise<string>) | undefined} minifyFn
 */
async function collectStats(currentStats, outputOptions, bundle, flags, minifyFn) {
    const format = outputOptions.format;

    await Promise.all(
        Object.entries(bundle).map(async ([fileName, item]) => {
            if (item.type === 'chunk') {
                const code = /** @type {OutputChunk} */ (item).code;
                const raw = Buffer.byteLength(code, 'utf8');

                // Use minified code for compression if minify function is provided, otherwise use raw code
                let codeForCompression = code;
                /** @type {number | undefined} */
                let minifiedSize;

                if (minifyFn) {
                    const minifiedCode = await minifyFn(code, fileName);
                    minifiedSize = Buffer.byteLength(minifiedCode, 'utf8');
                    codeForCompression = minifiedCode;
                }

                const sizes = await compressSizes(Buffer.from(codeForCompression, 'utf8'), flags);

                const category = /** @type {OutputChunk} */ (item).isEntry ? 'entries' : 'chunks';
                if (!currentStats[category]) {
                    currentStats[category] = {};
                }
                const bucket = /** @type {Record<string, ChunkSizeStats>} */ (currentStats[category]);
                if (!bucket[format]) {
                    bucket[format] = { raw: 0 };
                }
                bucket[format].raw += raw;
                if (minifiedSize != null) {
                    bucket[format].minified = (bucket[format].minified ?? 0) + minifiedSize;
                }
                if (sizes.gzip != null) {
                    bucket[format].gzip = (bucket[format].gzip ?? 0) + sizes.gzip;
                }
                if (sizes.brotli != null) {
                    bucket[format].brotli = (bucket[format].brotli ?? 0) + sizes.brotli;
                }
            } else {
                const source = /** @type {OutputAsset} */ (item).source;
                const raw = typeof source === 'string' ? Buffer.byteLength(source, 'utf8') : source.byteLength;
                const ext = extname(fileName) || fileName;
                const buf = typeof source === 'string' ? Buffer.from(source, 'utf8') : Buffer.from(source);
                const sizes = await compressSizes(buf, flags);

                if (!currentStats.assets) {
                    currentStats.assets = {};
                }
                if (!currentStats.assets[ext]) {
                    currentStats.assets[ext] = { raw: 0 };
                }
                currentStats.assets[ext].raw += raw;
                if (sizes.gzip != null) {
                    currentStats.assets[ext].gzip = (currentStats.assets[ext].gzip ?? 0) + sizes.gzip;
                }
                if (sizes.brotli != null) {
                    currentStats.assets[ext].brotli = (currentStats.assets[ext].brotli ?? 0) + sizes.brotli;
                }
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
 * Chunks are minified with oxc-minify and then compressed with gzip and / or
 * brotli to produce the reported sizes. Assets are compressed only (no JS
 * minification). Results are compared against a persisted JSON stats file so
 * that size regressions are easy to spot.
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
            gzip: true,
            brotli: false,
        },
        factories
    );

    const { pluginName, statsFile, updateStats, logger, minify: minifyFn } = normalizedOptions;

    /** @type {CompressionFlags} */
    const flags = { gzip: normalizedOptions.gzip, brotli: normalizedOptions.brotli };

    /** @type {StatsData} */
    const currentStats = {};

    const instance = multiConfigPluginBase(false, pluginName, reportAndSave, onEachOutput);

    // Clear accumulated stats at the start of each new build cycle (watch mode support)
    instance.buildStart = () => {
        currentStats.entries = undefined;
        currentStats.chunks = undefined;
        currentStats.assets = undefined;
    };

    return instance;

    /**
     * Called on every generateBundle invocation (once per output config).
     * @param {NormalizedOutputOptions} outputOptions
     * @param {OutputBundle} bundle
     */
    async function onEachOutput(outputOptions, bundle) {
        await collectStats(currentStats, outputOptions, bundle, flags, minifyFn);
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
