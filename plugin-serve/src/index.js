import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';

/**
 * @import { Server } from 'node:http'
 * @import { AddressInfo } from 'node:net'
 * @import { NormalizedInputOptions, NormalizedOutputOptions, Plugin, PluginContext } from 'rollup'
 * @import serve from 'koa-static'
 */

/**
 * @typedef {{ pluginName?: string, useWriteBundle?: boolean, dirs?: string | string[], port?: number, useKoaLogger?: boolean, koaStaticOptions?: serve.Options, host?: string, https?: { cert: string, key: string, ca?: string }, customizeKoa?: (koa: Koa) => void, onListen?: (server: Server) => void | true }} ServePluginOptionsObject
 */

/**
 * @typedef {ServePluginOptionsObject | string | string[]} ServePluginOptions
 */

import Koa from 'koa';
import koaLogger from 'koa-logger';
import serveStatic from 'koa-static';

import { LogLevel } from '@niceties/logger';
import logger from '@rollup-extras/utils/logger';
import { multiConfigPluginBase } from '@rollup-extras/utils/mutli-config-plugin-base';
import { getOptions } from '@rollup-extras/utils/options';

/** @type {Server | undefined} */
let globalServer;

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
            useKoaLogger: true,
        },
        'dirs',
        factories
    );
    const { pluginName, useWriteBundle, port, host, https, useKoaLogger, customizeKoa, koaStaticOptions, onListen, logger } =
        normalizedOptions;
    const instance = multiConfigPluginBase(useWriteBundle, pluginName, serve);

    let { dirs } = normalizedOptions,
        collectDirs = false,
        started = false,
        watchMode = true;

    const pluginInstance = { ...instance, outputOptions };

    if (!dirs) {
        dirs = [];
        collectDirs = true;
        pluginInstance.renderStart = renderStart;
    }

    return /** @type {Plugin} */ (pluginInstance);

    /** @this {PluginContext} */
    function renderStart(/** @type {NormalizedOutputOptions} */ outputOptions, /** @type {NormalizedInputOptions} */ inputOptions) {
        /** @type {(this: PluginContext, outputOptions: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) => void | Promise<void>} */
        (/** @type {Required<typeof instance>} */ (instance).renderStart).call(this, outputOptions, inputOptions);
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

    /** @this {PluginContext} */
    async function serve() {
        if (!started && watchMode) {
            started = true;

            if (globalServer) {
                await new Promise(resolve => /** @type {Server} */ (globalServer).close(resolve));
                globalServer = undefined;
            }

            const app = new Koa();

            if (customizeKoa) {
                customizeKoa(app);
            }

            if (useKoaLogger) {
                app.use(koaLogger());
            }

            for (const dir of /** @type {string[]} */ (dirs)) {
                app.use(serveStatic(dir, koaStaticOptions));
            }

            const server = https ? createHttpsServer(https, app.callback()) : createServer(app.callback());
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
    }

    /**
     * @param {Server} server
     */
    function internalOnListen(server) {
        if (!onListen || !onListen(server)) {
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
