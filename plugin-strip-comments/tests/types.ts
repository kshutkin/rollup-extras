// biome-ignore-all lint: test file

import stripComments from '@rollup-extras/plugin-strip-comments';

import type { Plugin } from 'rollup';

// --- default call ---
const plugin1: Plugin = stripComments();

// --- single string shorthand ---
const plugin2: Plugin = stripComments('license');
const plugin3: Plugin = stripComments('annotation');
const plugin4: Plugin = stripComments('regular');
const plugin5: Plugin = stripComments('jsdoc');

// --- array shorthand ---
const plugin6: Plugin = stripComments(['jsdoc', 'regular']);
const plugin7: Plugin = stripComments(['license']);

// --- `true` shorthand ---
const plugin8: Plugin = stripComments(true);

// --- options object ---
const plugin9: Plugin = stripComments({
    types: 'license',
    pluginName: 'my-strip',
});
const plugin10: Plugin = stripComments({ types: ['jsdoc', 'regular'] });
const plugin11: Plugin = stripComments({ types: true });
const plugin12: Plugin = stripComments({ pluginName: 'only-name' });

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - number is not valid
stripComments(123);

// @ts-expect-error - invalid comment type string
stripComments('bogus');

// @ts-expect-error - invalid comment type in array
stripComments(['bogus']);

// @ts-expect-error - invalid type in options object
stripComments({ types: 'bogus' });

// @ts-expect-error - types cannot be `false`
stripComments({ types: false });
