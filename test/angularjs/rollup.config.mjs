import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import lightningcss from 'postcss-lightningcss';
import globImport from 'rollup-plugin-glob-import';
import livereload from 'rollup-plugin-livereload';
import styles from 'rollup-plugin-styles';

import templateCache from '@rollup-extras/plugin-angularjs-template-cache';
import clean from '@rollup-extras/plugin-clean';
import copy from '@rollup-extras/plugin-copy';
import html from '@rollup-extras/plugin-html';
import { combineAssetFactories, simpleES5Script } from '@rollup-extras/plugin-html/asset-factories';
import prebundle from '@rollup-extras/plugin-prebundle';
import scriptLoader from '@rollup-extras/plugin-script-loader';
import serve from '@rollup-extras/plugin-serve';
import size from '@rollup-extras/plugin-size';

const production = !process.env.ROLLUP_WATCH;

export default {
    input: 'src/main.js',
    output: {
        sourcemap: true,
        format: 'es',
        dir: 'dist',
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
    },
    plugins: [
        clean(),

        // Prebundle nudeui web components into a single chunk
        prebundle({
            packages: ['nudeui'],
            enableInBuildMode: true,
        }),

        // Copy nudeui's shadow DOM CSS so import.meta.url resolves correctly
        copy('node_modules/nudeui/meter-discrete/style.css'),

        scriptLoader({
            emit: 'asset',
            name: 'vendor.js',
            exactFileName: false, // Use Rollup's assetFileNames pattern for hashing
            sourcemap: true,
        }),

        globImport({
            format: 'import',
        }),

        templateCache({
            templates: './src/views/**/*.html',
            rootDir: './src/views',
            transformHtmlImportsToUris: true,
        }),

        styles({
            mode: 'extract',
            sourceMap: !production,
            plugins: production ? [lightningcss()] : [],
        }),

        resolve({
            browser: true,
        }),

        commonjs(),

        serve({
            port: 8087,
        }),

        !production && livereload({ watch: 'dist', delay: 500 }),

        production && terser(),

        size(),

        html({
            template: 'index.html',
            assetsFactory: combineAssetFactories(
                // Inject vendor bundle as classic (non-module) script before ES modules
                simpleES5Script(/vendor\..*\.js$/)
            ),
        }),
    ],
    watch: {
        clearScreen: false,
    },
};
