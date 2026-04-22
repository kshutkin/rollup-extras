import { createServer as createHttpsServer } from 'node:https';

/**
 * @import { Server } from 'node:http'
 * @import { AddressInfo } from 'node:net'
 * @import { NormalizedInputOptions, NormalizedOutputOptions, OutputAsset, OutputBundle, OutputChunk, Plugin, PluginContext } from 'rollup'
 * @import { ServerType } from '@hono/node-server'
 */

/**
 * @typedef {{ pluginName?: string, useWriteBundle?: boolean, inMemory?: boolean, liveReload?: boolean, dirs?: string | string[], port?: number, useLogger?: boolean, staticOptions?: object, host?: string, https?: { cert: string, key: string, ca?: string }, customize?: (app: Hono) => void, onListen?: (server: Server) => true | void }} ServePluginOptionsObject
 */

/**
 * @typedef {ServePluginOptionsObject | string | string[]} ServePluginOptions
 */

import { createAdaptorServer } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { getMimeType } from 'hono/utils/mime';

import { LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { multiConfigPluginBase } from '@rollup-extras/utils/multi-config-plugin-base';
import { getOptions } from '@rollup-extras/utils/options';

import { createLiveReload } from './livereload.js';

/** @type {ServerType | undefined} */
let globalServer;

/** @type {ReturnType<typeof createLiveReload> | undefined} */
let globalLiveReload;

const factories = { logger };

/**
 * @param {ServePluginOptions} [options]
 * @returns {Plugin}
 */
export default function (options = {}) {
    const normalizedOptions = getOptions(
        options,
        {
            pluginName: '@rollup-extras/plugin-serve',
            useWriteBundle: true,
            port: 8080,
            useLogger: true,
            liveReload: true,
        },
        'dirs',
        factories
    );
    const { pluginName, port, host, https, useLogger, customize, staticOptions, onListen, logger, inMemory, liveReload } =
        normalizedOptions;
    const useWriteBundle = inMemory ? false : normalizedOptions.useWriteBundle;
    const instance = inMemory
        ? multiConfigPluginBase(useWriteBundle, pluginName, serve, captureOutput)
        : multiConfigPluginBase(useWriteBundle, pluginName, serve);

    /** @type {Map<string, { content: string | Uint8Array, type: string }>} */
    const memoryFiles = new Map();

    let { dirs } = normalizedOptions,
        collectDirs = false,
        started = false,
        watchMode = true;

    const pluginInstance = { ...instance, outputOptions };

    if (!dirs) {
        dirs = [];
        collectDirs = true;
        pluginInstance.renderStart = renderStart;
    } else if (inMemory) {
        pluginInstance.renderStart = renderStart;
    }

    return /** @type {Plugin} */ (pluginInstance);

    /** @this {PluginContext} */
    function renderStart(/** @type {NormalizedOutputOptions} */ outputOptions, /** @type {NormalizedInputOptions} */ inputOptions) {
        /** @type {(this: PluginContext, outputOptions: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) => void | Promise<void>} */
        (/** @type {Required<typeof instance>} */ (instance).renderStart).call(this, outputOptions, inputOptions);
        if (inMemory) {
            memoryFiles.clear();
        }
        if (collectDirs) {
            if (outputOptions.dir) {
                /** @type {string[]} */ (dirs).push(outputOptions.dir);
            }
        }
    }

    /** @this {PluginContext} */
    function outputOptions() {
        watchMode = this.meta.watchMode;
        return null;
    }

    /**
     * @param {OutputBundle} bundle
     */
    function captureBundle(bundle) {
        for (const key in bundle) {
            const item = /** @type {OutputAsset | OutputChunk} */ (bundle[key]);
            const content = item.type === 'chunk' ? item.code : item.source;
            memoryFiles.set(item.fileName, { content, type: getMimeType(item.fileName) || 'application/octet-stream' });
        }
    }

    /** @this {PluginContext} */
    function captureOutput(
        /** @type {NormalizedOutputOptions} */ _options,
        /** @type {OutputBundle} */ bundle,
        /** @type {number} */ _remainingConfigsCount,
        /** @type {number} */ _remainingOutputsCount
    ) {
        captureBundle(bundle);
    }

    /** @this {PluginContext} */
    async function serve() {
        if (!watchMode) {
            return;
        }
        if (started) {
            if (liveReload) {
                globalLiveReload?.broadcast('reload');
            }
            return;
        }
        started = true;

        if (globalServer) {
            globalLiveReload?.close();
            globalLiveReload = undefined;
            await new Promise(resolve => /** @type {ServerType} */ (globalServer).close(resolve));
            globalServer = undefined;
        }

        const app = new Hono();

        if (customize) {
            customize(app);
        }

        if (liveReload) {
            globalLiveReload = createLiveReload();
            globalLiveReload.register(app);
        }

        if (useLogger) {
            app.use('*', honoLogger());
        }

        if (inMemory) {
            app.use('*', inMemoryMiddleware(memoryFiles));
        }

        for (const dir of /** @type {string[]} */ (dirs)) {
            app.use('*', serveStatic({ root: dir, ...staticOptions }));
        }

        const server = createAdaptorServer({
            fetch: app.fetch,
            ...(https ? { createServer: createHttpsServer, serverOptions: https } : {}),
        });
        globalServer = server;

        const listenCb = () => internalOnListen(server);

        if (host) {
            server.listen(port, host, listenCb);
        } else {
            server.listen(port, listenCb);
        }

        server.on('error', (/** @type {NodeJS.ErrnoException} */ e) => {
            if (e.code === 'EADDRINUSE') {
                logger.finish('address in use, please try another port', LogLevel.error);
            } else {
                throw e;
            }
        });
    }

    /**
     * @param {ServerType} server
     */
    function internalOnListen(server) {
        if (!onListen?.(/** @type {Server} */ (server))) {
            logger.finish(`listening on ${linkFromAddress(server.address(), !!https)}`, LogLevel.info);
        }
    }
}

/**
 * @param {AddressInfo | string | null} address
 * @param {boolean} https
 * @returns {string}
 */
function linkFromAddress(address, https) {
    if (address && typeof address !== 'string') {
        return linkFromAddressInfo(address, https);
    }
    return `${address}`;
}

/**
 * @param {AddressInfo} addressInfo
 * @param {boolean} https
 * @returns {string}
 */
function linkFromAddressInfo({ address, port, family }, https) {
    let serverName = family === 'IPv6' ? `[${address}]` : address;
    if (serverName === '[::]') {
        serverName = 'localhost';
    }
    const protocol = `http${https ? 's' : ''}://`;
    return `${protocol}${serverName}:${port}`;
}

/**
 * @param {Map<string, { content: string | Uint8Array, type: string }>} files
 * @returns {import('hono').MiddlewareHandler}
 */
function inMemoryMiddleware(files) {
    return async (c, next) => {
        let pathname = new URL(c.req.url).pathname;
        if (pathname.endsWith('/')) {
            pathname += 'index.html';
        }
        const fileName = pathname.startsWith('/') ? pathname.slice(1) : pathname;
        const file = files.get(fileName);
        if (file) {
            return c.body(file.content, 200, { 'Content-Type': file.type });
        }
        await next();
    };
}
