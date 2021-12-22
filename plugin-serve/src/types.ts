import Koa from 'koa';
import serve from 'koa-static';
import { Server } from 'http';

export type ServePluginOptions = {
    pluginName?: string;
    useWriteBundle?: boolean;
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
} | string | string[];
