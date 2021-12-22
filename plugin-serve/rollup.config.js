import fs from 'fs';
import path from 'path';
import isBuiltinModule from 'is-builtin-module';
import camelCase from 'lodash/camelCase';

import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import preprocess from 'rollup-plugin-preprocess';

const pkg = JSON.parse(fs.readFileSync('./package.json'));
const input = [];

const threePartsFilenameTest = /(.*)\.(.*)\.(.*)/g;
const twoPartsFilenameTest = /(.*)\.(.*)/g;

const dest = 'dist';

const umdFilter = () => false;

if (typeof pkg.name !== 'string') {
    console.error(`expecting name to be a string in package.json`);
    process.exit(-1);
}

if (!Array.isArray(pkg.files)) {
    console.error(`expecting files to be an array in package.json`);
    process.exit(-1);
}

if (!pkg.files.includes(dest)) {
    console.warn(`no ${dest} in files in package.json`);
}

if (typeof pkg.exports !== 'object') {
    console.error('expecting exports object in package.json');
    process.exit(-1);
}

if (typeof pkg.umd !== 'string' && new RegExp(threePartsFilenameTest, 'g').test(pkg.umd)) {
    console.warn(`expecting module field as a string in format name.extension.js in package.json`);
}

for (const id in pkg.exports) {
    if (typeof pkg.exports[id] !== 'object') {
        console.error(`expecting exports['${id}'] object in package.json`);
        process.exit(-1);
    }
    if (typeof pkg.exports[id].require !== 'string') {
        console.error(`expecting exports['${id}'].require string in package.json`);
        process.exit(-1);
    }
    const filename = path.basename(pkg.exports[id].require);
    const filnameParts = new RegExp(twoPartsFilenameTest, 'g').exec(filename);

    if ((id == '.' ? 'index' : path.basename(id)) !== filnameParts[1]) {
        console.error(`expecting exports['${id}'].require to reference the same file as exports key`);
        process.exit(-1);
    }

    const modernFilename = path.basename(pkg.exports[id].default);
    const modernFilnameParts = new RegExp(twoPartsFilenameTest, 'g').exec(modernFilename);

    if (modernFilnameParts[2] !== 'mjs') {
        console.error(`expecting exports['${id}'].default to use [name].mjs name`);
        process.exit(-1);
    }

    if (filnameParts[1] !== 'index') {
        if (!fs.existsSync(filnameParts[1])) {
            console.warn(`submodule '${filnameParts[1]}' need a directory for package.json`);
        }

        if (!pkg.files.includes(filnameParts[1])) {
            console.warn(`submodule '${filnameParts[1]}' need to be included in files property for publishing`);
        }

        if (!fs.existsSync(`${filnameParts[1]}/package.json`)) {
            console.warn(`submodule '${filnameParts[1]}' need a package.json`);
        }

        const submodulePkg = JSON.parse(fs.readFileSync(`${filnameParts[1]}/package.json`));
        if (submodulePkg.types !== `../${dest}/${filnameParts[1]}.d.ts`) {
            console.warn(`wrong types field ${submodulePkg.types} for ${filnameParts[1]} submodule`);
        }
    }

    input.push(`./src/${filnameParts[1]}.ts`);
}

if (typeof pkg.main !== 'string') {
    console.warn(`expecting main field as a string in package.json`);
}

if (pkg.main !== pkg.exports['.']?.require) {
    console.warn(`expecting main field to be the same as exports['.'].require in package.json`);
}

if (typeof pkg.module !== 'string') {
    console.warn(`expecting module field as a string in package.json`);
}

if (pkg.module !== pkg.exports['.']?.default) {
    console.warn(`expecting module field to be the same as exports['.'].default in package.json`);
}

if (umdFilter('index')) {
    if (typeof pkg.unpkg !== 'string') {
        console.error(`expecting unpkg to be a string in package.json`);
        process.exit(-1);
    }

    if (pkg.unpkg !== './dist/index.umd.js') {
        console.error(`expecting unpkg to be ./dist/index.umd.js`);
        process.exit(-1);
    }
}

const plugins = [
    resolve(),
    commonjs(),
    typescript()
];

const external = (id) => id.indexOf('node_modules') >= 0 || id.indexOf('@rollup-extras') >= 0 || isBuiltinModule(id);

export default [{
	input,

    output: {
        format: 'es',
        dir: dest,
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs'
    },

	plugins: [preprocess({ include: [ 'src/index.ts' ], context: { esm: true } }), ...plugins],

    external
}, {
	input,

    output: {
        format: 'cjs',
        dir: dest,
        entryFileNames: '[name].cjs',
        chunkFileNames: '[name].cjs',
        exports: 'auto'
    },

	plugins: [preprocess({ include: [ 'src/index.ts' ], context: { cjs: true } }), ...plugins],

    external
}, ...input.filter(umdFilter).map(currentInput => ({
    input: currentInput,
    output: {
        format: 'umd',
        dir: dest,
        entryFileNames: '[name].umd.js',
        name: getGlobalName(currentInput),
        plugins: [terser({
            mangle: {
                properties: {
                    regex: /_$/
                }
            }
        })],
        sourcemap: true,
        globals: getExternalGlobalName
    },

	plugins: [preprocess({ include: [ 'src/index.ts' ], context: { cjs: true } }), ...plugins],

    external: (id) => external(id) || isExternalInput(id, input, currentInput)
}))];

function getExternalGlobalName(id) {
    if (path.isAbsolute(id)) {
        return getGlobalName(path.relative(__dirname, id));
    }
    return camelCase(id);
}

function getGlobalName(anInput) {
    return camelCase(path.join(pkg.name, path.basename(anInput, '.ts') !== 'index' ? path.basename(anInput, '.ts') : ''));
}

function isExternalInput(id, inputs, currentInput) {
    let normalizedPath;
    if (path.isAbsolute(id)) {
        normalizedPath = './' + path.relative(__dirname, id);
    } else {
        normalizedPath = './' + path.join('src', id + '.ts');
    }
    return normalizedPath !== currentInput && inputs.includes(normalizedPath);
}