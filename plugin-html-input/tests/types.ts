// biome-ignore-all lint: test file

import htmlInput from '@rollup-extras/plugin-html-input';

import type { Plugin } from 'rollup';

// --- default call ---
const p1: Plugin = htmlInput();

// --- with options ---
const p2: Plugin = htmlInput({
    pluginName: 'my-html-input',
    verbose: true,
    input: 'src/index.html',
    emit: true,
    filter: (src, attrs) => attrs.type === 'module' && src.endsWith('.js'),
    removeNonMatched: false,
});

// --- input array ---
const p3: Plugin = htmlInput({ input: ['a.html', 'b.html'] });
