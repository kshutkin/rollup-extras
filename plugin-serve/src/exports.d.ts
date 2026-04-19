import type { Server } from 'node:http';

import type { ServeStaticOptions } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';
import type { Plugin } from 'rollup';

export type ServePluginOptionsObject = {
    pluginName?: string;
    useWriteBundle?: boolean;
    inMemory?: boolean;
    dirs?: string | string[];
    port?: number;
    useLogger?: boolean;
    staticOptions?: Omit<ServeStaticOptions, 'root' | 'path'>;
    host?: string;
    https?: {
        cert: string;
        key: string;
        ca?: string;
    };
    customize?: (app: Hono) => void;
    onListen?: (server: Server) => undefined | true;
};

export type ServePluginOptions = ServePluginOptionsObject | string | string[];

export default function serve(options?: ServePluginOptions): Plugin;
