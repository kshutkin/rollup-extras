import "@niceties/draftlog-appender";
// import { appender } from "@niceties/logger";
import clean from '@rollup-extras/plugin-clean';
import copy from '@rollup-extras/plugin-copy';
import html from '@rollup-extras/plugin-html';
import serve from '@rollup-extras/plugin-serve';
import crypto from 'crypto';
import sb from 'simply-beautiful';
import fs from 'fs';

// appender((msg) => {
//     console.log(msg.message);
// });

const input = 'src/index.ts';

const htmlPluginInstance = html({
    template: 'src/index.html',
    verbose: true,
    assetsFactory: (fileName, content) => {
        if (fileName.endsWith('.css')) {
            const data = crypto
                .createHash('sha384')
                .update(content);
            return `<link rel="stylesheet" href="${fileName}" integrity="sha384-${data.digest('base64')}" type="text/css">`;
        }
        return undefined;
    },
    templateFactory: (template, assets, defaultFactory) => sb.html(defaultFactory(template, assets))
});

const server = serve({host: 'localhost', https: {
    cert: fs.readFileSync('cert/cert.pem'),
    key: fs.readFileSync('cert/key.pem'),
}})

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
        clean({ verbose: true }),
        copy({ targets: ['src/test/index.html', 'src/test.css'], verbose: true }),
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

	plugins: [clean(), copy('./assets/**/*.json'), htmlPluginInstance.api.addInstance(), server.api.addInstance()],
}, {
    input,
    output: {
        format: 'umd',
        dir: './dest4',
        entryFileNames: '[name].umd.js',
        name: 'test',
        plugins: [clean(), copy({ src: './assets/**/*.json', outputPlugin: true }), htmlPluginInstance.api.addInstance(), server.api.addInstance()],
        sourcemap: true
    }
}];