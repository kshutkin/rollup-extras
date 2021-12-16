import { NormalizedInputOptions, NormalizedOutputOptions, PluginContext, PluginHooks } from 'rollup';
import base from './base';
import { BaseMulticonfigPluginOptions, ExtendedServePluginOptions, ServePluginOptions } from './types';
import { AddressInfo } from 'net';
import { Server, createServer } from 'http';
import { createServer as createHttpsServer} from 'https';
import Koa from 'koa';
import koaLogger from 'koa-logger';
import serveStatic from 'koa-static';
import { createLogger, LogLevel } from '@niceties/logger';

let globalServer: Server | undefined;

export default function(options: ServePluginOptions = {}) {
    const [ baseInstance, { pluginName } ] = base(options as BaseMulticonfigPluginOptions, '@rollup-extras/plugin-serve', true, serve);
    const normalizedOptions = normalizeOptions(options),
        { port, host, https, useKoaLogger, customizeKoa, koaStaticOptions, customOnListen } = normalizedOptions;
    let { dirs } = normalizedOptions,
        collectDirs = false, started = false, watchMode = true;

    const logger = createLogger(pluginName);

    const instance = { ...baseInstance, outputOptions };
    if (!dirs) {
        dirs = [];
        collectDirs = true;
        instance.renderStart = renderStart;
    }

    return instance;

    function renderStart(this: PluginContext, outputOptions: NormalizedOutputOptions, inputOptions: NormalizedInputOptions) {
        (baseInstance as PluginHooks).renderStart.call(this, outputOptions, inputOptions);
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

            const listenCb = () => onListen(server);

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

    function onListen(server: Server) {
        if (!customOnListen || customOnListen(server)) {
            logger.finish(`listening on ${linkFromAddress(server.address(), !!https)}`, LogLevel.info);
        }
    }
}

type NormilizedOptions = {
    dirs?: string[],
    port: number,
    host?: string,
    useKoaLogger?: boolean,
    koaStaticOptions?: serveStatic.Options,
    https?: ExtendedServePluginOptions['https'],
    customizeKoa?: ExtendedServePluginOptions['customizeKoa'],
    customOnListen?: (server: Server) => void | true,
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

function normalizeOptions(userOptions: ServePluginOptions): NormilizedOptions {
    const options = {
        dirs: getDirs(userOptions),
        port: (userOptions as ExtendedServePluginOptions).port ?? 8080,
        host: (userOptions as ExtendedServePluginOptions).host,
        https: (userOptions as ExtendedServePluginOptions).https,
        koaStaticOptions: (userOptions as ExtendedServePluginOptions).koaStaticOptions,
        customizeKoa: (userOptions as ExtendedServePluginOptions).customizeKoa,
        useKoaLogger: (userOptions as ExtendedServePluginOptions).useKoaLogger,
        customOnListen: (userOptions as ExtendedServePluginOptions).onListen,
    };

    return options;
}

function getDirs(userOptions: ServePluginOptions): string[] | undefined {
    if (typeof userOptions === 'string') {
        return [userOptions];
    }
    if (Array.isArray(userOptions)) {
        return userOptions;
    }
    if (typeof userOptions === 'object') {
        return 'dirs' in userOptions ? getDirs(userOptions.dirs as string | string[]) : undefined;
    }
    return [];
}