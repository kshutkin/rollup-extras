// biome-ignore-all lint: test file

import scriptLoader from '@rollup-extras/plugin-script-loader';

import type { Plugin } from 'rollup';

// --- default call ---
const plugin: Plugin = scriptLoader();

// --- with full options ---
const plugin2: Plugin = scriptLoader({
    prefix: 'script!',
    useStrict: true,
    pluginName: 'my-script-loader',
    verbose: true,
});

// --- with partial options ---
const plugin3: Plugin = scriptLoader({ prefix: 'script-loader!' });
const plugin4: Plugin = scriptLoader({ verbose: false });
const plugin5: Plugin = scriptLoader({});
const plugin6: Plugin = scriptLoader({ useStrict: false });
const plugin7: Plugin = scriptLoader({ useStrict: true, prefix: 'script-loader!' });

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - string is not valid
scriptLoader('something');

// @ts-expect-error - number is not valid
scriptLoader(123);

// @ts-expect-error - boolean is not valid
scriptLoader(true);

// @ts-expect-error - array is not valid
scriptLoader(['a', 'b']);
