// import "@niceties/draftlog-appender";
// import { appender } from "@niceties/logger";
import clean from '@rollup-extras/plugin-clean';
import copy from '@rollup-extras/plugin-copy';
import html from '@rollup-extras/plugin-html';

// appender((msg) => {
//     console.log(msg.message);
// });

const input = 'src/index.ts';

const htmlPluginInstance = html({
    template: 'src/index.html'
});

export default [{
	input,

    output: [{
        format: 'es',
        dir: 'dest',
        entryFileNames: '[name].js'
    }, {
        format: 'es',
        dir: 'dest',
        entryFileNames: '[name]second.js'
    }],

	plugins: [
        clean({ verbose: true }),
        copy({ src: 'src/test/index.html', verbose: true }),
        htmlPluginInstance
    ],
}, {
	input,

    output: {
        format: 'cjs',
        dir: './dest3',
        entryFileNames: '[name].cjs',
        chunkFileNames: '[name].cjs'
    },

	plugins: [clean(), copy('./assets/**/*.json'), htmlPluginInstance.api.addInstance()],
}, {
    input,
    output: {
        format: 'umd',
        dir: './dest',
        entryFileNames: '[name].umd.js',
        name: 'test',
        plugins: [clean(), copy({ src: './assets/**/*.json', outputPlugin: true }), htmlPluginInstance.api.addInstance()],
        sourcemap: true
    }
}];