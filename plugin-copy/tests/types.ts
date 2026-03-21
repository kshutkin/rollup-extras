// biome-ignore-all lint: test file

import copy from '@rollup-extras/plugin-copy';

import type { Plugin } from 'rollup';

// --- with string shorthand ---
const plugin1: Plugin = copy('src/**/*.png');

// --- with string array ---
const plugin2: Plugin = copy(['src/**/*.png', 'src/**/*.svg']);

// --- with single target desc ---
const plugin3: Plugin = copy({ src: 'assets/**/*', dest: 'public' });

// --- with full options ---
const plugin4: Plugin = copy({
    targets: [{ src: 'assets/**/*', dest: 'public', exclude: '**/*.map' }],
    pluginName: 'my-copy',
    copyOnce: false,
    watch: true,
    verbose: 'list-filenames',
    flatten: true,
    exactFileNames: false,
    outputPlugin: false,
    emitFiles: true,
    emitOriginalFileName: 'relative',
});

// --- with emitOriginalFileName function ---
const plugin5: Plugin = copy({
    targets: 'src/**/*',
    emitOriginalFileName: fileName => `/custom/${fileName}`,
});

// --- with partial options ---
const plugin6: Plugin = copy({ targets: 'src/**/*' });

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - number is not valid
copy(123);

// @ts-expect-error - boolean is not valid
copy(true);
