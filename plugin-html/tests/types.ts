// biome-ignore-all lint: test file

import html from '@rollup-extras/plugin-html';
import {
    combineAssetFactories,
    simpleES5FallbackScript,
    simpleES5Script,
    simpleModuleScript,
} from '@rollup-extras/plugin-html/asset-factories';

import type { Plugin } from 'rollup';

// ============================================================================
// main plugin
// ============================================================================

// --- default call ---
const plugin: Plugin = html();

// --- with options ---
const plugin2: Plugin = html({
    pluginName: 'my-html',
    outputFile: 'index.html',
    template: '<!DOCTYPE html><html><head></head><body></body></html>',
    watch: true,
    emitFile: true,
    verbose: false,
    useWriteBundle: false,
    useEmittedTemplate: false,
    conditionalLoading: true,
    injectIntoHead: '.css',
    ignore: false,
});

// --- with template file ---
const plugin3: Plugin = html({ template: 'src/index.html' });

// --- with predicate options ---
const plugin4: Plugin = html({
    injectIntoHead: fileName => fileName.endsWith('.css'),
    ignore: /\.map$/,
});

// --- with assetsFactory ---
const plugin5: Plugin = html({
    assetsFactory: (fileName, content, type) => {
        return `<custom-element src="${fileName}"></custom-element>`;
    },
});

// --- with templateFactory ---
const plugin6: Plugin = html({
    templateFactory: (template, assets, defaultFactory) => {
        return defaultFactory(template, assets);
    },
});

// ============================================================================
// asset-factories
// ============================================================================

const es5 = simpleES5Script('.js');
const es5Fallback = simpleES5FallbackScript('.js');
const module_ = simpleModuleScript('.mjs');
const combined = combineAssetFactories(es5, es5Fallback, module_);

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - string is not valid for html plugin
html('not valid');

// @ts-expect-error - number is not valid for html plugin
html(123);
