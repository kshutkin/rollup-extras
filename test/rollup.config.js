// import "@niceties/draftlog-appender";
// import { appender } from "@niceties/logger";
import clean from '@rollup-extras/plugin-clean';

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
        dir: './dest/',
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs'
    }],

	plugins: [clean()],
}, {
	input,

    output: {
        format: 'cjs',
        dir: './dest3',
        entryFileNames: '[name].cjs',
        chunkFileNames: '[name].cjs'
    },

	plugins: [clean()],
}, {
    input,
    output: {
        format: 'umd',
        dir: './dest4',
        entryFileNames: '[name].umd.js',
        name: 'test',
        plugins: [clean()],
        sourcemap: true
    }
}];