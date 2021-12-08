// import "@niceties/draftlog-appender";
// import { appender } from "@niceties/logger";
import clean from '@rollup-extras/plugin-clean';
import copy from '@rollup-extras/plugin-copy';

// appender((msg) => {
//     console.log(msg.message);
// });

const input = 'src/index.ts';

export default [{
	input,

    output: [{
        format: 'es',
        dir: './dest',
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs'
    }, {
        format: 'es',
        dir: './dest2/',
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs'
    }],

	plugins: [clean({
        verbose: true
    }), copy({
        targets: [
            { src: './assets/*', dest: './dest', exclude: '*.json' }
        ],
        flattern: false,
        emitFiles: false,
        outputPlugin: true,
        verbose: true
    })],
}, {
	input,

    output: {
        format: 'cjs',
        dir: './dest3',
        entryFileNames: '[name].cjs',
        chunkFileNames: '[name].cjs'
    },

	plugins: [clean(), copy('./assets/**/*.json')],
}, {
    input,
    output: {
        format: 'umd',
        dir: './dest4',
        entryFileNames: '[name].umd.js',
        name: 'test',
        plugins: [clean(), copy({ src: './assets/**/*.json', outputPlugin: true })],
        sourcemap: true
    }
}];