// biome-ignore-all lint: test file

import clean from '@rollup-extras/plugin-clean';
import type { Plugin } from 'rollup';

// --- default call ---
const plugin: Plugin = clean();

// --- with string ---
const plugin2: Plugin = clean('dist');

// --- with string array ---
const plugin3: Plugin = clean(['dist', 'build']);

// --- with options object ---
const plugin4: Plugin = clean({
    targets: ['dist'],
    pluginName: 'my-clean',
    deleteOnce: false,
    outputPlugin: false,
    verbose: true,
});

// --- with partial options ---
const plugin5: Plugin = clean({ targets: 'dist' });
const plugin6: Plugin = clean({ deleteOnce: true });

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - number is not valid
clean(123);

// @ts-expect-error - boolean is not valid
clean(true);
