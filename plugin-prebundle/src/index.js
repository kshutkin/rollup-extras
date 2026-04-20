import { createHash } from 'node:crypto';
import { dirname, posix, relative } from 'node:path';

/**
 * @import { Plugin, PluginContext, SourceMap } from 'rollup'
 */

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import isBuiltinModule from 'is-builtin-module';
import { packageDirectory } from 'pkg-dir';
import { rollup } from 'rollup';

import { LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { getOptionsObject } from '@rollup-extras/utils/options';

const PREBUNDLE_PREFIX = '\0prebundle:';
const PREBUNDLE_CHUNK = '_prebundled.js';

const factories = { logger };

/**
 * @typedef {{ pluginName?: string, packages?: string[], enableInBuildMode?: boolean }} PrebundlePluginOptions
 */

/**
 * @param {string} specifier
 * @returns {string}
 */
function specifierToNamespace(specifier) {
    return `__pre_${specifier.replace(/@/g, '').replace(/\//g, '__').replace(/-/g, '_').replace(/\./g, '_')}`;
}

/**
 * @param {string} specifier
 * @returns {string}
 */
function getPackageName(specifier) {
    if (specifier.startsWith('@')) {
        const parts = specifier.split('/');
        return parts.slice(0, 2).join('/');
    }
    return specifier.split('/')[0];
}

/** @type {{ code: string, exports: string[], map: SourceMap | null, specifiers: Set<string> } | undefined} */
let prebundleCache;

/**
 * @param {PrebundlePluginOptions} [options]
 * @returns {Plugin}
 */
export default function (options = {}) {
    const { pluginName, packages, enableInBuildMode, logger } = getOptionsObject(
        options,
        {
            pluginName: '@rollup-extras/plugin-prebundle',
            enableInBuildMode: false,
        },
        factories
    );

    /** @type {Set<string>} */
    const discoveredSpecifiers = new Set();
    /** @type {string | false} */
    let pkgDir = false;
    let watchMode = false;
    let enabled = true;
    let prebundleFileName = PREBUNDLE_CHUNK;

    return /** @type {Plugin} */ ({
        name: pluginName,

        /** @this {PluginContext} */
        buildStart() {
            watchMode = this.meta.watchMode;
            enabled = watchMode || enableInBuildMode;
            if (!enabled) {
                logger('build mode detected, prebundling disabled (set enableInBuildMode: true to override)', LogLevel.info);
            }
            discoveredSpecifiers.clear();
        },

        /** @this {PluginContext} */
        async resolveId(source, importer) {
            if (!enabled) return null;

            // Handle the prebundled chunk itself — mark it external
            if (source === `./${PREBUNDLE_CHUNK}` || source === PREBUNDLE_CHUNK) {
                return { id: `./${PREBUNDLE_CHUNK}`, external: true };
            }

            // Handle virtual proxy modules
            if (source.startsWith(PREBUNDLE_PREFIX)) {
                return { id: source };
            }

            // Skip relative/absolute paths — only intercept bare specifiers
            if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0')) {
                return null;
            }

            // Skip Node builtins
            if (isBuiltinModule(source)) {
                return null;
            }

            if (pkgDir === false) {
                pkgDir = (await packageDirectory()) ?? '.';
            }

            // Check if the import is external (resolves outside project root or into node_modules)
            const resolution = await this.resolve(source, importer, { skipSelf: true });

            if (!resolution || resolution.external) {
                // Unresolved or already external — this is a candidate for prebundling
                return addToPrebundle(source, resolution);
            }

            // Check if it resolves into node_modules or outside the project
            const resolvedPath = resolution.id;
            if (resolvedPath.includes('node_modules') || relative(pkgDir, resolvedPath).startsWith('..')) {
                return addToPrebundle(source, resolution);
            }

            return null;
        },

        /** @this {PluginContext} */
        load(id) {
            if (!enabled) return null;

            if (id.startsWith(PREBUNDLE_PREFIX)) {
                const specifier = id.slice(PREBUNDLE_PREFIX.length);
                const ns = specifierToNamespace(specifier);
                return {
                    code: `export { ${ns} as default } from './${PREBUNDLE_CHUNK}';\n`,
                    syntheticNamedExports: true,
                };
            }

            return null;
        },

        renderChunk(code, chunk) {
            if (!enabled || !code.includes(`./${PREBUNDLE_CHUNK}`)) return null;
            // Fix the import path to the hashed prebundled chunk relative to the chunk's output location
            const chunkDir = dirname(chunk.fileName);
            const target = chunkDir === '.' ? './' + prebundleFileName : (() => {
                const rel = posix.relative(chunkDir, prebundleFileName);
                return rel.startsWith('.') ? rel : './' + rel;
            })();
            return { code: code.replaceAll(`./${PREBUNDLE_CHUNK}`, target), map: null };
        },

        generateBundle(_, bundle) {
            if (!enabled || prebundleFileName === PREBUNDLE_CHUNK) return;
            // Fix chunk imports metadata so other plugins (e.g. html) see the hashed filename
            for (const key in bundle) {
                const chunk = bundle[key];
                if (chunk.type === 'chunk') {
                    for (let i = 0; i < chunk.imports.length; i++) {
                        if (chunk.imports[i] === PREBUNDLE_CHUNK || chunk.imports[i] === `./${PREBUNDLE_CHUNK}`) {
                            chunk.imports[i] = prebundleFileName;
                        }
                    }
                }
            }
        },

        /** @this {PluginContext} */
        async buildEnd() {
            if (!enabled || discoveredSpecifiers.size === 0) return;

            // Check if we can reuse the cache
            if (prebundleCache && setsEqual(prebundleCache.specifiers, discoveredSpecifiers)) {
                logger('reusing cached prebundle', LogLevel.verbose);
                prebundleFileName = emitPrebundleChunk.call(this, prebundleCache.code, prebundleCache.exports, prebundleCache.map);
                return;
            }

            logger(`prebundling ${discoveredSpecifiers.size} external(s): ${[...discoveredSpecifiers].join(', ')}`, LogLevel.info);

            try {
                const virtualEntry = [...discoveredSpecifiers]
                    .map(s => `export * as ${specifierToNamespace(s)} from ${JSON.stringify(s)};`)
                    .join('\n');

                const childBundle = await rollup({
                    input: '\0prebundle-entry',
                    plugins: [
                        {
                            name: 'prebundle-virtual-entry',
                            resolveId(id) {
                                if (id === '\0prebundle-entry') return id;
                                return null;
                            },
                            load(id) {
                                if (id === '\0prebundle-entry') return virtualEntry;
                                return null;
                            },
                        },
                        nodeResolve({ preferBuiltins: false }),
                        json(),
                        commonjs(),
                    ],
                    onwarn() {},
                });

                const { output } = await childBundle.generate({ format: 'es', sourcemap: 'hidden' });
                await childBundle.close();

                const chunk = output[0];
                prebundleCache = {
                    code: chunk.code,
                    exports: chunk.exports,
                    map: chunk.map ?? null,
                    specifiers: new Set(discoveredSpecifiers),
                };

                prebundleFileName = emitPrebundleChunk.call(this, chunk.code, chunk.exports, chunk.map ?? null);
            } catch (e) {
                logger(`prebundling failed: ${/** @type {Error} */ (e).message}`, LogLevel.warn);
                // On failure, clear cache so next build retries
                prebundleCache = undefined;
            }
        },
    });

    /**
     * @param {string} source
     * @param {{ id: string } | null} [resolution]
     * @returns {{ id: string } | null}
     */
    function addToPrebundle(source, resolution) {
        const pkgName = getPackageName(source);

        // If packages list is configured, only prebundle those
        if (packages && !packages.includes(pkgName)) {
            return null;
        }

        discoveredSpecifiers.add(source);

        // Watch the resolved file so changes trigger rebuilds
        if (resolution?.id && !resolution.id.startsWith('\0')) {
            try {
                // @ts-expect-error - addWatchFile requires `this` context from a hook, called from resolveId
                this.addWatchFile(resolution.id);
            } catch {
                // addWatchFile may not be available in all contexts
            }
        }

        // If we already have a cache that includes this specifier, redirect to proxy
        if (prebundleCache?.specifiers.has(source)) {
            return { id: PREBUNDLE_PREFIX + source };
        }

        // First build or new specifier — on first build we haven't prebundled yet.
        // We need to let the build continue and prebundle in buildEnd.
        // For now, return the proxy id — it will be loaded with syntheticNamedExports.
        // The prebundle chunk will be emitted in buildEnd.
        return { id: PREBUNDLE_PREFIX + source };
    }
}

/**
 * @this {PluginContext}
 * @param {string} code
 * @param {string[]} exports
 * @param {SourceMap | null} map
 */
function emitPrebundleChunk(code, exports, map) {
    const hash = createHash('sha256').update(code).digest('hex').slice(0, 8);
    const fileName = `_prebundled.${hash}.js`;
    this.emitFile({
        type: 'prebuilt-chunk',
        fileName,
        code,
        exports,
        ...(map ? { map } : {}),
    });
    return fileName;
}

/**
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {boolean}
 */
function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const item of a) {
        if (!b.has(item)) return false;
    }
    return true;
}
