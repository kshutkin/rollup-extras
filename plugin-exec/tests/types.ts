// biome-ignore-all lint: test file

import exec from '@rollup-extras/plugin-exec';

import type { Plugin } from 'rollup';

// --- with callback ---
const plugin1 = exec(function () {
    this.logger('hello');
});

// --- with options object ---
const plugin2 = exec({
    pluginName: 'my-exec',
    exec() {
        this.logger('hello');
    },
});

// --- with just pluginName ---
const plugin3 = exec({ pluginName: 'my-exec' });

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - string is not valid
exec('not valid');

// @ts-expect-error - number is not valid
exec(123);
