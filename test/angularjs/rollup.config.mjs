import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import lightningcss from 'postcss-lightningcss';
import globImport from 'rollup-plugin-glob-import';
import livereload from 'rollup-plugin-livereload';
import styles from 'rollup-plugin-styles';

import templateCache from '@rollup-extras/plugin-angularjs-template-cache';
import clean from '@rollup-extras/plugin-clean';
import html from '@rollup-extras/plugin-html';
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

        scriptLoader({ useStrict: false }),

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
        }),
    ],
    watch: {
        clearScreen: false,
    },
};
