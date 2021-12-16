import Koa from 'koa';
import serve from 'koa-static';
import { Server } from 'http';

export type BaseMulticonfigPluginOptions = {
    pluginName?: string;
    useWriteBundle?: boolean;
};

export type ExtendedServePluginOptions = {
    dirs?: string | string[];
    port?: number;
    useKoaLogger?: boolean;
    koaStaticOptions?: serve.Options;
    host?: string;
    https?: {
        cert: string;
        key: string;
        ca?: string;
    },
    customizeKoa?: (koa: Koa) => void;
    onListen?: (server: Server) => void | true;
};

export type ServePluginOptions = BaseMulticonfigPluginOptions & ExtendedServePluginOptions | string | string[];
