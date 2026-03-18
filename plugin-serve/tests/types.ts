// biome-ignore-all lint: test file

import type { Server } from 'node:http';

import serve from '@rollup-extras/plugin-serve';

import type Koa from 'koa';
import type { Options as KoaStaticOptions } from 'koa-static';
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
    dirs: ['dist'],
    port: 3000,
    host: 'localhost',
    useKoaLogger: false,
    https: {
        cert: 'cert.pem',
        key: 'key.pem',
        ca: 'ca.pem',
    },
    koaStaticOptions: { maxage: 1000, defer: true },
    customizeKoa: koa => {},
    onListen: server => {},
});

// --- with partial options ---
const plugin5: Plugin = serve({ port: 9000 });
const plugin6: Plugin = serve({ dirs: 'public' });

// --- with koaStaticOptions ---
const plugin7: Plugin = serve({ koaStaticOptions: { defer: true } });
const plugin8: Plugin = serve({
    dirs: 'public',
    koaStaticOptions: { maxage: 60000, hidden: false, gzip: true },
});

// --- verify callback parameter types ---
serve({
    customizeKoa: (koa: Koa) => {
        koa.use(async (ctx, next) => next());
    },
    onListen: (server: Server) => {
        server.close();
    },
});

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - number is not valid
serve(123);

// @ts-expect-error - boolean is not valid
serve(true);

// @ts-expect-error - koaStaticOptions should not accept a string
serve({ koaStaticOptions: 'invalid' });

// @ts-expect-error - koaStaticOptions should not accept a number
serve({ koaStaticOptions: 42 });
