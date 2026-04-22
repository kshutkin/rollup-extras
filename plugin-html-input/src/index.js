import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';

/**
 * @import { InputOptions, NormalizedOutputOptions, OutputBundle, Plugin, PluginContext } from 'rollup'
 */

/**
 * @typedef {(src: string, attrs: Record<string, string>) => boolean} ScriptFilter
 */

/**
 * @typedef {object} HtmlInputPluginOptions
 * @property {string} [pluginName]
 * @property {boolean} [verbose]
 * @property {string | string[]} [input] Path(s) to HTML file(s). When omitted,
 *   `.html` / `.htm` entries in rollup's own `input` are used.
 * @property {boolean} [emit] Emit the cleaned HTML as a rollup asset so
 *   downstream plugins (notably `@rollup-extras/plugin-html`) can pick it up.
 *   Default: `true`.
 * @property {ScriptFilter} [filter] Override the default script selection.
 *   Default keeps local `<script type="module" src="…">` with JS-like extension.
 * @property {boolean} [removeNonMatched] Remove all local `<script src>` tags
 *   that were not selected as inputs. Default: `false`.
 */

import { LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { getOptionsObject } from '@rollup-extras/utils/options';

import { extractScripts } from './parser.js';

const jsExtensions = /** @type {ReadonlyArray<string>} */ (['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.jsx']);
const htmlExtensions = /** @type {ReadonlyArray<string>} */ (['.html', '.htm']);

const factories = { logger };

/** @type {ScriptFilter} */
const defaultFilter = (src, attrs) => isLocalSrc(src) && (attrs.type || '').toLowerCase() === 'module' && hasJsExtension(src);

/**
 * @param {HtmlInputPluginOptions} [options]
 * @returns {Plugin}
 */
export default function (options = {}) {
    const { pluginName, verbose, input, emit, filter, removeNonMatched, logger } = getOptionsObject(
        options,
        {
            pluginName: '@rollup-extras/plugin-html-input',
            verbose: false,
            emit: true,
            filter: defaultFilter,
            removeNonMatched: false,
        },
        factories
    );
    const logLevel = verbose ? LogLevel.info : LogLevel.verbose;

    /** @type {Map<string, string>} cleaned HTML keyed by absolute path */
    const cleanedCache = new Map();
    /** @type {Map<string, string>} asset fileName keyed by absolute path */
    const emitPathByHtml = new Map();
    /** @type {string[]} absolute paths of HTML sources */
    let htmlPaths = [];

    const userHtmlInputs = normalizeUserHtmlInputs(input);

    return /** @type {Plugin} */ ({
        name: pluginName,
        /**
         * @this {PluginContext}
         * @param {InputOptions} opts
         */
        async options(opts) {
            const { rollupHtmlEntries, otherEntries, rollupInputShape } = splitRollupInput(opts.input);
            const usePluginInputs = userHtmlInputs.length > 0;
            const mergingMode = usePluginInputs ? 'extend' : 'replace';

            const sources = usePluginInputs ? userHtmlInputs.map(p => resolve(p)) : rollupHtmlEntries.map(p => resolve(p));

            if (sources.length === 0) {
                logger('no HTML inputs found — plugin is a no-op', logLevel);
                return null;
            }

            htmlPaths = sources;
            emitPathByHtml.clear();
            computeEmitPaths(sources, emitPathByHtml);

            /** @type {Record<string, string>} */
            const inferred = {};
            /** @type {Set<string>} */
            const usedKeys = new Set();

            for (const htmlPath of sources) {
                let raw;
                try {
                    raw = await readFile(htmlPath, 'utf8');
                } catch (e) {
                    logger(`failed to read HTML input '${htmlPath}'`, LogLevel.error, e);
                    throw e;
                }
                const { cleanedHtml, scripts } = extractScripts(raw, makeEffectiveFilter(filter, removeNonMatched));
                cleanedCache.set(htmlPath, cleanedHtml);

                const htmlDir = dirname(htmlPath);
                for (const script of scripts) {
                    if (!filter(script.src, script.attrs)) {
                        // matched only by removeNonMatched; do not turn into an input
                        continue;
                    }
                    const abs = resolve(htmlDir, script.src);
                    const key = uniqueKey(abs, usedKeys);
                    inferred[key] = abs;
                }
                logger(`parsed '${htmlPath}': ${scripts.length} script tag(s) matched`, logLevel);
            }

            const newInput = buildNewInput(rollupInputShape, otherEntries, inferred, mergingMode);

            return /** @type {InputOptions} */ ({ ...opts, input: newInput });
        },
        /** @this {PluginContext} */
        async buildStart() {
            for (const p of htmlPaths) {
                this.addWatchFile(p);
            }
            // Re-read templates on every build to pick up changes in watch mode
            for (const p of htmlPaths) {
                try {
                    const raw = await readFile(p, 'utf8');
                    const { cleanedHtml } = extractScripts(raw, makeEffectiveFilter(filter, removeNonMatched));
                    cleanedCache.set(p, cleanedHtml);
                } catch (e) {
                    logger(`failed to re-read HTML input '${p}'`, LogLevel.warn, e);
                }
            }
        },
        /**
         * @this {PluginContext}
         * @param {NormalizedOutputOptions} _options
         * @param {OutputBundle} bundle
         */
        generateBundle(_options, bundle) {
            if (!emit) return;
            for (const htmlPath of htmlPaths) {
                const fileName = /** @type {string} */ (emitPathByHtml.get(htmlPath));
                const source = cleanedCache.get(htmlPath);
                if (source == null) continue;
                if (fileName in bundle) {
                    logger(`'${fileName}' already present in bundle — skipping emit`, LogLevel.verbose);
                    continue;
                }
                this.emitFile({ type: 'asset', fileName, source });
            }
        },
    });

    /**
     * @param {string} abs
     * @param {Set<string>} used
     * @returns {string}
     */
    function uniqueKey(abs, used) {
        const base = basename(abs, extname(abs));
        if (!used.has(base)) {
            used.add(base);
            return base;
        }
        const parent = basename(dirname(abs));
        const withParent = parent ? `${parent}_${base}` : base;
        if (!used.has(withParent)) {
            used.add(withParent);
            logger(`entry key '${base}' already used; using '${withParent}' for '${abs}'`, LogLevel.warn);
            return withParent;
        }
        let n = 2;
        while (used.has(`${withParent}_${n}`)) n++;
        const finalKey = `${withParent}_${n}`;
        used.add(finalKey);
        logger(`entry key collision; using '${finalKey}' for '${abs}'`, LogLevel.warn);
        return finalKey;
    }
}

/**
 * @param {string | string[] | undefined} input
 * @returns {string[]}
 */
function normalizeUserHtmlInputs(input) {
    if (input == null) return [];
    return Array.isArray(input) ? input.slice() : [input];
}

/**
 * @param {InputOptions['input']} input
 * @returns {{ rollupHtmlEntries: string[], otherEntries: Record<string, string> | string[] | string | undefined, rollupInputShape: 'string' | 'array' | 'object' | 'undefined' }}
 */
function splitRollupInput(input) {
    if (input == null) {
        return { rollupHtmlEntries: [], otherEntries: undefined, rollupInputShape: 'undefined' };
    }
    if (typeof input === 'string') {
        if (isHtmlPath(input)) {
            return { rollupHtmlEntries: [input], otherEntries: undefined, rollupInputShape: 'string' };
        }
        return { rollupHtmlEntries: [], otherEntries: input, rollupInputShape: 'string' };
    }
    if (Array.isArray(input)) {
        /** @type {string[]} */
        const html = [];
        /** @type {string[]} */
        const other = [];
        for (const item of input) {
            if (isHtmlPath(item)) html.push(item);
            else other.push(item);
        }
        return { rollupHtmlEntries: html, otherEntries: other, rollupInputShape: 'array' };
    }
    /** @type {string[]} */
    const html = [];
    /** @type {Record<string, string>} */
    const other = {};
    for (const [k, v] of Object.entries(input)) {
        if (isHtmlPath(v)) html.push(v);
        else other[k] = v;
    }
    return { rollupHtmlEntries: html, otherEntries: other, rollupInputShape: 'object' };
}

/**
 * @param {'string' | 'array' | 'object' | 'undefined'} shape
 * @param {Record<string, string> | string[] | string | undefined} otherEntries
 * @param {Record<string, string>} inferred
 * @param {'replace' | 'extend'} mode
 * @returns {InputOptions['input']}
 */
function buildNewInput(shape, otherEntries, inferred, mode) {
    if (mode === 'replace') {
        // Replace HTML entries with inferred JS entries; preserve other entries
        if (shape === 'string') {
            // The single input was HTML — convert to inferred inputs
            const keys = Object.keys(inferred);
            if (keys.length === 1) return inferred[keys[0]];
            return inferred;
        }
        if (shape === 'array') {
            const other = /** @type {string[]} */ (otherEntries ?? []);
            if (other.length === 0) return inferred;
            // Mixed: promote to object form to preserve inferred keys
            /** @type {Record<string, string>} */
            const merged = { ...inferred };
            /** @type {Set<string>} */
            const used = new Set(Object.keys(inferred));
            for (const p of other) {
                const key = pickKey(p, used);
                merged[key] = p;
            }
            return merged;
        }
        if (shape === 'object') {
            const other = /** @type {Record<string, string> | undefined} */ (otherEntries) ?? {};
            /** @type {Record<string, string>} */
            const merged = { ...other, ...inferred };
            return merged;
        }
        // shape === 'undefined' shouldn't happen in replace mode
        return inferred;
    }

    // mode === 'extend' — user provided plugin.input; keep user's rollup input as-is and append inferred
    if (shape === 'undefined') {
        const keys = Object.keys(inferred);
        if (keys.length === 1) return inferred[keys[0]];
        return inferred;
    }
    if (shape === 'string') {
        const base = /** @type {string} */ (otherEntries);
        /** @type {Set<string>} */
        const used = new Set(Object.keys(inferred));
        const key = pickKey(base, used);
        return { ...inferred, [key]: base };
    }
    if (shape === 'array') {
        const other = /** @type {string[] | undefined} */ (otherEntries) ?? [];
        /** @type {Record<string, string>} */
        const merged = { ...inferred };
        /** @type {Set<string>} */
        const used = new Set(Object.keys(inferred));
        for (const p of other) {
            const key = pickKey(p, used);
            merged[key] = p;
        }
        return merged;
    }
    // shape === 'object'
    const other = /** @type {Record<string, string> | undefined} */ (otherEntries) ?? {};
    /** @type {Record<string, string>} */
    const merged = { ...other };
    for (const [k, v] of Object.entries(inferred)) {
        if (k in merged) {
            let n = 2;
            while (`${k}_${n}` in merged) n++;
            merged[`${k}_${n}`] = v;
        } else {
            merged[k] = v;
        }
    }
    return merged;
}

/**
 * @param {string} p
 * @param {Set<string>} used
 * @returns {string}
 */
function pickKey(p, used) {
    const base = basename(p, extname(p));
    if (!used.has(base)) {
        used.add(base);
        return base;
    }
    let n = 2;
    while (used.has(`${base}_${n}`)) n++;
    const key = `${base}_${n}`;
    used.add(key);
    return key;
}

/**
 * @param {string} p
 * @returns {boolean}
 */
function isHtmlPath(p) {
    const ext = extname(p).toLowerCase();
    return htmlExtensions.includes(ext);
}

/**
 * @param {string} src
 * @returns {boolean}
 */
function isLocalSrc(src) {
    if (!src) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return false; // scheme
    if (src.startsWith('//')) return false; // protocol-relative
    return true;
}

/**
 * @param {string} src
 * @returns {boolean}
 */
function hasJsExtension(src) {
    const q = src.indexOf('?');
    const h = src.indexOf('#');
    let end = src.length;
    if (q >= 0) end = Math.min(end, q);
    if (h >= 0) end = Math.min(end, h);
    const clean = src.slice(0, end);
    const ext = extname(clean).toLowerCase();
    return jsExtensions.includes(ext);
}

/**
 * Builds a filter that selects scripts for removal from the cleaned HTML.
 * Matches = scripts that become inputs. Additionally, when `removeNonMatched`
 * is true, any other local `<script src>` is also stripped.
 *
 * @param {ScriptFilter} userFilter
 * @param {boolean} removeNonMatched
 * @returns {ScriptFilter}
 */
function makeEffectiveFilter(userFilter, removeNonMatched) {
    return (src, attrs) => {
        if (userFilter(src, attrs)) return true;
        if (removeNonMatched && isLocalSrc(src)) return true;
        return false;
    };
}

/**
 * Computes the asset `fileName` for each HTML source. For a single input this
 * is just the basename; for multiple inputs it is the relative path from the
 * common parent directory so MPA-style layouts are preserved.
 *
 * @param {string[]} sources absolute paths
 * @param {Map<string, string>} out
 */
function computeEmitPaths(sources, out) {
    if (sources.length === 0) return;
    if (sources.length === 1) {
        const p = sources[0];
        out.set(p, basename(p));
        return;
    }
    const root = commonParent(sources);
    for (const p of sources) {
        const rel = relative(root, p);
        out.set(p, rel === '' || rel.startsWith('..') ? basename(p) : rel);
    }
}

/**
 * @param {string[]} paths
 * @returns {string}
 */
function commonParent(paths) {
    const absPaths = paths.map(p => (isAbsolute(p) ? p : resolve(p)));
    const split = absPaths.map(p => dirname(p).split(/[\\/]/));
    const first = split[0];
    let i = 0;
    outer: for (; i < first.length; i++) {
        for (let j = 1; j < split.length; j++) {
            if (split[j][i] !== first[i]) break outer;
        }
    }
    const common = first.slice(0, i).join('/') || '/';
    return common;
}
