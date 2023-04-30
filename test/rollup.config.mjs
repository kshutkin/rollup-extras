// import "@niceties/draftlog-appender";
import { appender } from "@niceties/logger";
import cleanPlugin from '@rollup-extras/plugin-clean';
import copy from '@rollup-extras/plugin-copy';
import html from '@rollup-extras/plugin-html';
import serve from '@rollup-extras/plugin-serve';
import binify from '@rollup-extras/plugin-binify';
import externals from '@rollup-extras/plugin-externals';
import templateCache from '@rollup-extras/plugin-angularjs-template-cache';
import crypto from 'crypto';
import sb from 'simply-beautiful';
import fs from 'fs';
import { combineAssetFactories, simpleES5Script } from "@rollup-extras/plugin-html/asset-factories";
import htmlImport from 'rollup-plugin-html';

appender((msg) => {
    console.log(msg.message);
});

const input = 'src/index.js';

const htmlPluginInstance = html({
    template: 'src/index.html',
    verbose: true,
    assetsFactory: combineAssetFactories((fileName, content) => {
        if (fileName.endsWith('.css')) {
            const data = crypto
                .createHash('sha384')
                .update(content);
            return `<link rel="stylesheet" href="${fileName}" integrity="sha384-${data.digest('base64')}" type="text/css">`;
        }
        return undefined;
    }, simpleES5Script('.js')),
    templateFactory: (template, assets, defaultFactory) => sb.html(defaultFactory(template, assets))
});

const server = serve({host: 'localhost', https: {
    cert: fs.readFileSync('cert/cert.pem'),
    key: fs.readFileSync('cert/key.pem'),
}})

const clean = cleanPlugin({verbose: true, deleteOnce: true});

export default [{
	input,

    output: [{
        format: 'es',
        dir: 'dest',
        entryFileNames: '[name].[hash].js'
    }, {
        format: 'es',
        dir: 'dest/subdir',
        entryFileNames: '[name].[hash].second.js'
    }],

	plugins: [
        clean,
        htmlImport({include: '**/*.html'}),
        templateCache({ templates: './src/**/*.html', rootDir: './src', useImports: true, autoImport: false }),
        externals(),
        copy({ targets: ['src/test/index.html', 'src/test.css', 'src/index2.js'], verbose: 'list-filenames' }),
        htmlPluginInstance,
        server
    ],
}, {
	input,

    output: {
        format: 'cjs',
        dir: './dest3',
        entryFileNames: '[name].cjs',
        chunkFileNames: '[name].cjs'
    },

	plugins: [clean.api.addInstance(), copy('./assets/**/*.json'), htmlPluginInstance.api.addInstance(), server.api.addInstance()],
}, {
    input,
    output: {
        format: 'umd',
        dir: './dest4',
        entryFileNames: '[name].umd.js',
        name: 'test',
        plugins: [clean.api.addInstance(), copy({ src: './assets/**/*.json', outputPlugin: true }), htmlPluginInstance.api.addInstance(), server.api.addInstance()],
        sourcemap: true
    }
}, {
    input,
    output: {
        format: 'cjs',
        dir: './dest5',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].cjs',
        plugins: [clean.api.addInstance(), copy({ src: './assets/**/*.json', outputPlugin: true }), htmlPluginInstance.api.addInstance(), server.api.addInstance(), binify({verbose: true})],
        sourcemap: true
    }
}];