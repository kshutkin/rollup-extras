// biome-ignore-all lint: test file

import prebundle from '@rollup-extras/plugin-prebundle';

import type { Plugin } from 'rollup';

// --- default call ---
const plugin: Plugin = prebundle();

// --- with packages ---
const plugin2: Plugin = prebundle({
    packages: ['react', 'lodash-es'],
});

// --- with all options ---
const plugin3: Plugin = prebundle({
    pluginName: 'my-prebundle',
    packages: ['react'],
    enableInBuildMode: true,
});
