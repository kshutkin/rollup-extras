// biome-ignore-all lint: test file

import binify from '@rollup-extras/plugin-binify';

import type { OutputChunk, Plugin } from 'rollup';

// --- default call ---
const plugin: Plugin = binify();

// --- with options ---
const plugin2: Plugin = binify({
    pluginName: 'my-binify',
    verbose: true,
    shebang: '#!/usr/bin/env node\n',
    executableFlag: 0o755,
    filter: item => item.type === 'chunk' && (item as OutputChunk).isEntry,
});

// --- with partial options ---
const plugin3: Plugin = binify({ shebang: '#!/usr/bin/env bun' });
const plugin4: Plugin = binify({ executableFlag: false });
const plugin5: Plugin = binify({});

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - string is not valid
binify('not valid');

// @ts-expect-error - number is not valid
binify(123);
