// biome-ignore-all lint: test file

import serve from '@rollup-extras/plugin-serve';

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
    customizeKoa: koa => {},
    onListen: server => {},
});

// --- with partial options ---
const plugin5: Plugin = serve({ port: 9000 });
const plugin6: Plugin = serve({ dirs: 'public' });

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - number is not valid
serve(123);

// @ts-expect-error - boolean is not valid
serve(true);
