import { Server, createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { AddressInfo } from 'net';

import { NormalizedInputOptions, NormalizedOutputOptions, PluginContext, PluginHooks } from 'rollup';

import Koa from 'koa';
import koaLogger from 'koa-logger';
import serveStatic from 'koa-static';

import { LogLevel } from '@niceties/logger';
import { getOptions } from '@rollup-extras/utils/options';
import logger from '@rollup-extras/utils/logger';
import { multiConfigPluginBase } from '@rollup-extras/utils/mutli-config-plugin-base';

import { ServePluginOptions } from './types';

let globalServer: Server | undefined;

const factories = { logger };

export default function(options: ServePluginOptions = {}) {
    const normalizedOptions = getOptions(options, {
        pluginName: '@rollup-extras/plugin-serve',
        useWriteBundle: true,
        port: 8080,
        useKoaLogger: true
    }, 'dirs', factories);
    const { pluginName, useWriteBundle, port, host, https, useKoaLogger, customizeKoa, koaStaticOptions, onListen, logger } = normalizedOptions;
    const instance = multiConfigPluginBase(useWriteBundle, pluginName, serve);
    
    let { dirs } = normalizedOptions,
        collectDirs = false, started = false, watchMode = true;

    const pluginInstance = { ...instance, outputOptions };

    if (!dirs) {
        dirs = [];
        collectDirs = true;
        pluginInstance.renderStart = renderStart;
    }

    return pluginInstance;

    function renderStart(this: PluginContext, outputOptions: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) {
        (instance as PluginHooks).renderStart.call(this, outputOptions, inputOptions);
        if (collectDirs) {
            if (outputOptions.dir) {
                (dirs as string[]).push(outputOptions.dir);
            }
        }
    }

    function outputOptions(this: PluginContext) {
        watchMode = this.meta.watchMode;
        return null;
    }

    async function serve(this: PluginContext) {
        if (!started && watchMode) {
            started = true;

            if (globalServer) {
                await new Promise(resolve => (globalServer as Server).close(resolve));
                globalServer = undefined;
            }

            const app = new Koa();

            if (customizeKoa) {
                customizeKoa(app);
            }

            if (useKoaLogger) {
                app.use(koaLogger());
            }

            for (const dir of dirs as string[]) {
                app.use(serveStatic(dir, koaStaticOptions));
            }

            const server = globalServer = https ? createHttpsServer(https, app.callback()) : createServer(app.callback());

            const listenCb = () => internalOnListen(server);

            if (host) {
                server.listen(port, host, listenCb);
            } else {
                server.listen(port, listenCb);
            }

            server.on('error', (e: NodeJS.ErrnoException) => {
                if (e.code === 'EADDRINUSE') {
                    logger.finish('address in use, please try another port', LogLevel.error);
                } else {
                    throw e;
                }
            });
        }
    }

    function internalOnListen(server: Server) {
        if (!onListen || !onListen(server)) {
            logger.finish(`listening on ${linkFromAddress(server.address(), !!https)}`, LogLevel.info);
        }
    }
}

function linkFromAddress(address: AddressInfo | string | null, https: boolean) {
    if (address && typeof address !== 'string') {
        return linkFromAddressInfo(address, https);
    }
    return `${address}`;
}

function linkFromAddressInfo({ address, port, family }: AddressInfo, https: boolean) {
    const serverName = family === 'IPv6' ? `[${address}]` : address;
    const protocol = `http${https ? 's' : ''}://`;
    return `${protocol}${serverName}:${port}`;
}
