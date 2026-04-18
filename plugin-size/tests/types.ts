// biome-ignore-all lint: test file

import size from '@rollup-extras/plugin-size';

import type { Plugin } from 'rollup';

// --- default call ---
const plugin1: Plugin = size();

// --- with empty options ---
const plugin2: Plugin = size({});

// --- with all options ---
const plugin3: Plugin = size({
    statsFile: '.my-stats.json',
    updateStats: false,
    pluginName: 'my-size',
    gzip: true,
    brotli: true,
});

// --- with partial options ---
const plugin4: Plugin = size({ statsFile: 'stats.json' });
const plugin5: Plugin = size({ updateStats: true });
const plugin6: Plugin = size({ pluginName: 'custom' });
const plugin7: Plugin = size({ gzip: false });
const plugin8: Plugin = size({ brotli: true });
const plugin9: Plugin = size({ gzip: true, brotli: false });

// --- with minify function ---
const plugin10: Plugin = size({
    minify: async (code: string, fileName: string) => code.replace(/\s+/g, ''),
});
const plugin11: Plugin = size({
    minify: async (code, _fileName) => code,
});
const plugin12: Plugin = size({
    gzip: true,
    brotli: true,
    minify: async code => code,
});

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - string is not valid
size('test');

// @ts-expect-error - number is not valid
size(123);

// @ts-expect-error - boolean is not valid
size(true);

// @ts-expect-error - array is not valid
size(['a', 'b']);

// @ts-expect-error - minify must be a function
size({ minify: 'not a function' });

// @ts-expect-error - minify must return a Promise<string>
size({ minify: (code: string) => code });

// @ts-expect-error - minify must return a Promise<string>, not Promise<{ code: string }>
size({ minify: async (code: string) => ({ code }) });
