// biome-ignore-all lint: test file

import type { Server } from 'node:http';

import serve from '@rollup-extras/plugin-serve';

import type { Hono } from 'hono';
import type { Plugin } from 'rollup';

// --- default call ---
const plugin: Plugin = serve();

// --- with string shorthand ---
const plugin2: Plugin = serve('dist');

// --- with string array ---
const plugin3: Plugin = serve(['dist', 'public']);

// --- with full options ---
const plugin4: Plugin = serve({
    pluginName: 'my-serve',
    useWriteBundle: true,
    inMemory: false,
    liveReload: false,
    dirs: ['dist'],
    port: 3000,
    host: 'localhost',
    useLogger: false,
    https: {
        cert: 'cert.pem',
        key: 'key.pem',
        ca: 'ca.pem',
    },
    staticOptions: { precompressed: true },
    customize: app => {},
    onListen: server => undefined,
});

// --- with partial options ---
const plugin5: Plugin = serve({ port: 9000 });
const plugin6: Plugin = serve({ dirs: 'public' });

// --- with staticOptions ---
const plugin7: Plugin = serve({ staticOptions: { precompressed: true } });
const plugin8: Plugin = serve({
    dirs: 'public',
    staticOptions: { rewriteRequestPath: (path: string) => path.replace(/^\/assets/, '') },
});

// --- verify callback parameter types ---
serve({
    customize: (app: Hono) => {
        app.use('*', async (_c, next) => {
            await next();
        });
    },
    onListen: (server: Server) => {
        server.close();
        return undefined;
    },
});

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - number is not valid
serve(123);

// @ts-expect-error - boolean is not valid
serve(true);

// @ts-expect-error - staticOptions should not accept a string
serve({ staticOptions: 'invalid' });

// @ts-expect-error - staticOptions should not accept a number
serve({ staticOptions: 42 });
