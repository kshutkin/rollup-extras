// biome-ignore-all lint: test file

import externals from '@rollup-extras/plugin-externals';

import type { Plugin } from 'rollup';

// --- default call ---
const plugin: Plugin = externals();

// --- with function shorthand ---
const plugin2: Plugin = externals((id, isExternal) => isExternal);

// --- with options object ---
const plugin3: Plugin = externals({
    pluginName: 'my-externals',
    verbose: true,
    external: (id, isExternal, importer) => {
        return isExternal;
    },
});

// --- with partial options ---
const plugin4: Plugin = externals({ verbose: true });
const plugin5: Plugin = externals({});

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - number is not valid
externals(123);

// @ts-expect-error - string is not valid
externals('not valid');
