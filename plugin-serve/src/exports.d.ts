import type { Server } from 'node:http';

import type Koa from 'koa';
import type { Options as KoaStaticOptions } from 'koa-static';
import type { Plugin } from 'rollup';

export type ServePluginOptionsObject = {
    pluginName?: string;
    useWriteBundle?: boolean;
    dirs?: string | string[];
    port?: number;
    useKoaLogger?: boolean;
    koaStaticOptions?: KoaStaticOptions;
    host?: string;
    https?: {
        cert: string;
        key: string;
        ca?: string;
    };
    customizeKoa?: (koa: Koa) => void;
    onListen?: (server: Server) => void | true;
};

export type ServePluginOptions = ServePluginOptionsObject | string | string[];

export default function serve(options?: ServePluginOptions): Plugin;
