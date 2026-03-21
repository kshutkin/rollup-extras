// biome-ignore-all lint: test file

import angularTemplateCache from '@rollup-extras/plugin-angularjs-template-cache';

import type { Plugin } from 'rollup';

// --- default call ---
const plugin: Plugin = angularTemplateCache();

// --- with string shorthand ---
const plugin2: Plugin = angularTemplateCache('./**/*.html');

// --- with string array ---
const plugin3: Plugin = angularTemplateCache(['./**/*.html', './views/**/*.html']);

// --- with full options ---
const plugin4: Plugin = angularTemplateCache({
    templates: './**/*.html',
    watch: true,
    rootDir: '.',
    transformTemplateUri: uri => uri,
    processHtml: html => html.trim(),
    pluginName: 'my-template-cache',
    angularModule: 'templates',
    standalone: true,
    module: 'templates',
    importAngular: true,
    autoImport: false,
    verbose: 'list-filenames',
    useImports: false,
    transformHtmlImportsToUris: false,
});

// --- with partial options ---
const plugin5: Plugin = angularTemplateCache({ templates: './**/*.html' });
const plugin6: Plugin = angularTemplateCache({ standalone: false });

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error - number is not valid
angularTemplateCache(123);

// @ts-expect-error - boolean is not valid
angularTemplateCache(true);
