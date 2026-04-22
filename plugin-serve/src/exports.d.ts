import type { Server } from 'node:http';

import type { ServeStaticOptions } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';
import type { Plugin } from 'rollup';

export type ServePluginOptionsObject = {
    pluginName?: string;
    useWriteBundle?: boolean;
    inMemory?: boolean;
    /**
     * Enable live reload over Server-Sent Events. Defaults to `false`.
     *
     * Live reload is currently disabled by default. Set to `true` to opt in.
     *
     * When enabled and Rollup is running in watch mode, a small client script
     * is injected into every served `text/html` response and subscribes to an
     * SSE endpoint at `/__livereload`. After every rebuild the server
     * broadcasts a `reload` event that triggers `location.reload()` in the
     * browser.
     *
     * Set to `false` (or leave unset) to disable injection and the SSE endpoint.
     */
    liveReload?: boolean;
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
