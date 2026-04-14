// biome-ignore-all lint: test file

import mangle from '@rollup-extras/plugin-mangle';

import type { Plugin } from 'rollup';

// --- default call ---
const plugin1: Plugin = mangle();

// --- with string prefix ---
const plugin2: Plugin = mangle('$$');

// --- with options object ---
const plugin3: Plugin = mangle({
    prefix: '$$',
    pluginName: 'my-mangle',
});

// --- with partial options ---
const plugin4: Plugin = mangle({ prefix: '$_' });
const plugin5: Plugin = mangle({ pluginName: 'custom' });

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - number is not valid
mangle(123);

// @ts-expect-error - boolean is not valid
mangle(true);

// @ts-expect-error - array is not valid
mangle(['a', 'b']);
