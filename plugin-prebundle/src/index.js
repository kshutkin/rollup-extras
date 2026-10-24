import { createHash } from 'node:crypto';
import { dirname, isAbsolute, posix, relative } from 'node:path';

/**
 * @import { FunctionPluginHooks, Plugin, PluginContext, OutputChunk } from 'rollup'
 */

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import isBuiltinModule from 'is-builtin-module';
import { packageDirectory } from 'package-directory';
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

/** @typedef {{ source: string, importer?: string, id?: string }} PrebundleRequest */

/**
 * @param {string} specifier
 * @returns {string}
 */
function specifierToNamespace(specifier) {
    return `__pre_${createHash('sha256').update(specifier).digest('hex')}`;
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

    /** @type {{ chunks: OutputChunk[], requests: Map<string, PrebundleRequest>, watchFiles: string[] } | undefined} */
    let prebundleCache;
    /** @type {Map<string, PrebundleRequest>} */
    const discoveredRequests = new Map();
    /** @type {string | false} */
    let pkgDir = false;
    let watchMode = false;
    let enabled = true;
    let prebundleFileName = PREBUNDLE_CHUNK;
    let dependencyResolver = nodeResolve({ preferBuiltins: false });

    return /** @type {Plugin} */ ({
        name: pluginName,

        /** @this {PluginContext} */
        async buildStart(inputOptions) {
            watchMode = this.meta.watchMode;
            enabled = watchMode || enableInBuildMode;
            if (!enabled) {
                logger('build mode detected, prebundling disabled (set enableInBuildMode: true to override)', LogLevel.info);
            }
            discoveredRequests.clear();
            dependencyResolver = nodeResolve({ preferBuiltins: false });
            await /** @type {FunctionPluginHooks['buildStart']} */ (dependencyResolver.buildStart).call(this, inputOptions);
        },

        watchChange(id) {
            if (prebundleCache?.watchFiles.includes(id)) {
                prebundleCache = undefined;
            }
        },

        /** @this {PluginContext} */
        async resolveId(source, importer, resolveOptions) {
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
            const resolution = await resolveRequest.call(this, source, importer, resolveOptions);

            if (!resolution || resolution.external) {
                // Unresolved or already external — this is a candidate for prebundling
                return addToPrebundle.call(this, source, resolution, importer);
            }

            // Check if it resolves into node_modules or outside the project
            const resolvedPath = resolution.id;
            if (resolvedPath.includes('node_modules') || relative(pkgDir, resolvedPath).startsWith('..')) {
                return addToPrebundle.call(this, source, resolution, importer);
            }

            return null;
        },

        /** @this {PluginContext} */
        async shouldTransformCachedModule(info) {
            if (!enabled) return null;
            let changed = false;
            for (const [source, cachedResolution] of Object.entries(info.resolvedSources)) {
                const { id } = cachedResolution;
                if (!id.startsWith(PREBUNDLE_PREFIX)) continue;
                const resolution = await resolveRequest.call(this, source, info.id, {
                    attributes: cachedResolution.attributes,
                    isEntry: false,
                });
                const proxy = addToPrebundle.call(this, source, resolution, info.id);
                if (proxy?.id !== id) changed = true;
            }
            return changed || null;
        },

        /** @this {PluginContext} */
        async load(id) {
            if (!enabled) return null;

            if (id.startsWith(PREBUNDLE_PREFIX)) {
                const key = id.slice(PREBUNDLE_PREFIX.length);
                // Cached importers recheck their requests before reusing these shared proxies.
                if (!discoveredRequests.has(key)) {
                    const [source, target, importer] = /** @type {[string, string | null, string | null]} */ (JSON.parse(key));
                    discoveredRequests.set(key, { source, importer: importer ?? undefined, id: target ?? undefined });
                }
                const ns = specifierToNamespace(key);
                return {
                    code: `import { ${ns} } from './${PREBUNDLE_CHUNK}';\nexport const __moduleExports = ${ns};\n`,
                    syntheticNamedExports: '__moduleExports',
                };
            }

            return null;
        },

        renderChunk(code, chunk) {
            if (!enabled || !code.includes(`./${PREBUNDLE_CHUNK}`)) return null;
            // Fix the import path to the hashed prebundled chunk relative to the chunk's output location
            const chunkDir = dirname(chunk.fileName);
            const target =
                chunkDir === '.'
                    ? `./${prebundleFileName}`
                    : (() => {
                          const rel = posix.relative(chunkDir, prebundleFileName);
                          return rel.startsWith('.') ? rel : `./${rel}`;
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
            if (!enabled || discoveredRequests.size === 0) return;

            // Check if we can reuse the cache
            if (prebundleCache && requestsEqual(prebundleCache.requests, discoveredRequests)) {
                logger('reusing cached prebundle', LogLevel.verbose);
                prebundleFileName = emitPrebundleChunks.call(this, prebundleCache.chunks, prebundleCache.watchFiles);
                return;
            }

            logger(
                `prebundling ${discoveredRequests.size} external(s): ${[...discoveredRequests.values()].map(request => request.source).join(', ')}`,
                LogLevel.info
            );

            try {
                const virtualEntry = [...discoveredRequests.keys()]
                    .map(key => `export * as ${specifierToNamespace(key)} from ${JSON.stringify(PREBUNDLE_PREFIX + key)};`)
                    .join('\n');

                const childBundle = await rollup({
                    input: '\0prebundle-entry',
                    plugins: [
                        {
                            name: 'prebundle-virtual-entry',
                            async resolveId(id) {
                                if (id === '\0prebundle-entry') return id;
                                if (!id.startsWith(PREBUNDLE_PREFIX)) return null;
                                const request = discoveredRequests.get(id.slice(PREBUNDLE_PREFIX.length));
                                if (!request) return null;
                                if (request.id && isAbsolute(request.id)) return request.id;
                                const resolution = await this.resolve(
                                    request.id ?? request.source,
                                    request.importer && isAbsolute(request.importer) ? request.importer : undefined,
                                    { skipSelf: true }
                                );
                                if (!resolution)
                                    this.error(
                                        `Could not resolve "${request.source}" from "${request.importer ?? process.cwd()}" for prebundling`
                                    );
                                return resolution;
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
                    onwarn: warning => {
                        if (warning.code === 'UNRESOLVED_IMPORT' && !isBuiltinModule(warning.exporter ?? '')) this.error(warning);
                        this.warn(warning);
                    },
                });

                try {
                    const { output } = await childBundle.generate({
                        format: 'es',
                        sourcemap: 'hidden',
                        entryFileNames: '_prebundled.[hash].js',
                        chunkFileNames: '_prebundled.[hash].js',
                        hashCharacters: 'hex',
                    });
                    const watchFiles = childBundle.watchFiles.filter(isAbsolute);
                    const chunks = output.filter(item => item.type === 'chunk');
                    prebundleCache = { chunks, requests: new Map(discoveredRequests), watchFiles };
                    prebundleFileName = emitPrebundleChunks.call(this, chunks, watchFiles);
                } finally {
                    await childBundle.close();
                }
            } catch (e) {
                prebundleCache = undefined;
                this.error(/** @type {Error} */ (e));
            }
        },
    });

    /**
     * @this {PluginContext}
     * @param {string} source
     * @param {string} [importer]
     * @param {Parameters<FunctionPluginHooks['resolveId']>[2]} [resolveOptions]
     */
    async function resolveRequest(source, importer, resolveOptions) {
        const resolution = await this.resolve(source, importer, { ...resolveOptions, skipSelf: true });
        if (resolution?.id && isAbsolute(resolution.id)) return resolution;
        // The fallback supplies file resolution when the parent has no resolver or marks bare imports external.
        const context = Object.create(this);
        // node-resolve rechecks its resolved file through this.resolve; keep the parent's bare-import external policy out of that check.
        context.resolve = async (/** @type {string} */ id) => ({ id, external: false });
        const resolveHook = /** @type {{ handler: FunctionPluginHooks['resolveId'] }} */ (dependencyResolver.resolveId);
        const fallback = await resolveHook.handler.call(context, resolution?.id ?? source, importer, {
            attributes: {},
            isEntry: false,
            ...resolveOptions,
        });
        if (fallback && typeof fallback === 'object') return fallback;
        return resolution;
    }

    /**
     * @this {PluginContext}
     * @param {string} source
     * @param {{ id: string } | null} [resolution]
     * @param {string} [importer]
     * @returns {{ id: string } | null}
     */
    function addToPrebundle(source, resolution, importer) {
        const pkgName = getPackageName(source);

        // If packages list is configured, only prebundle those
        if (packages && !packages.includes(pkgName)) {
            return null;
        }

        const key = JSON.stringify([
            source,
            resolution?.id ?? null,
            resolution?.id && isAbsolute(resolution.id) ? null : (importer ?? null),
        ]);
        discoveredRequests.set(key, { source, importer, id: resolution?.id });

        // Watch the resolved file so changes trigger rebuilds
        if (resolution?.id && isAbsolute(resolution.id)) {
            this.addWatchFile(resolution.id);
        }

        return { id: PREBUNDLE_PREFIX + key };
    }
}

/**
 * @this {PluginContext}
 * @param {OutputChunk[]} chunks
 * @param {string[]} watchFiles
 */
function emitPrebundleChunks(chunks, watchFiles) {
    for (const file of watchFiles) {
        this.addWatchFile(file);
    }
    for (const chunk of chunks) {
        this.emitFile({
            type: 'prebuilt-chunk',
            fileName: chunk.fileName,
            code: chunk.code,
            exports: chunk.exports,
            ...(chunk.map ? { map: chunk.map } : {}),
        });
    }
    return /** @type {OutputChunk} */ (chunks.find(chunk => chunk.isEntry)).fileName;
}

/**
 * @param {Map<string, PrebundleRequest>} a
 * @param {Map<string, PrebundleRequest>} b
 * @returns {boolean}
 */
function requestsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const [key, request] of a) {
        if (!b.has(key) || b.get(key)?.id !== request.id) return false;
    }
    return true;
}
