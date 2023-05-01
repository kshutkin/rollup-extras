import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import styles from 'rollup-plugin-styles';
import clean from '@rollup-extras/plugin-clean';
import templateCache from '@rollup-extras/plugin-angularjs-template-cache';
import lightningcss from 'postcss-lightningcss';
import htmlImport from 'rollup-plugin-html';
import exec from '@rollup-extras/plugin-exec';
import globImport from 'rollup-plugin-glob-import';
import { spawn } from 'child_process';

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'test-bundle.js',
	output: {
		sourcemap: true,
		format: 'es',
		dir: 'dist',
		name: '_tb',
		entryFileNames: '[name].js'
	},
	plugins: [
		clean(),

		globImport({
			format: 'import'
		}),

		htmlImport(),

		templateCache({
			templates: './src/views/**/*.html',
			rootDir: './src/views',
			// autoImport: true,
			useImports: true,
			importAngular: false
		}),

		styles({
			mode: "extract",
			sourceMap: !production,
			plugins: production ? [lightningcss()] : []
		}),

		resolve({
			browser: true
		}),

		commonjs(),

		exec(() => {
			const server = spawn('npm', ['run', 'karma:watch'], {
				stdio: ['ignore', 'inherit', 'inherit'],
				shell: true
			});

			process.on('SIGTERM', () => server.kill(0));
			process.on('exit', () => server.kill(0));
		})
	],
	watch: {
		clearScreen: false
	}
};