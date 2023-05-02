import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import terser from '@rollup/plugin-terser';
import styles from 'rollup-plugin-styles';
import clean from '@rollup-extras/plugin-clean';
import html from '@rollup-extras/plugin-html';
import serve from '@rollup-extras/plugin-serve';
import templateCache from '@rollup-extras/plugin-angularjs-template-cache';
import lightningcss from 'postcss-lightningcss';
import htmlImport from 'rollup-plugin-html';
import globImport from 'rollup-plugin-glob-import';

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/main.js',
	output: {
		sourcemap: true,
		format: 'es',
		dir: 'dist',
		entryFileNames: 'assets/[name].[hash].js',
		chunkFileNames: 'assets/[name].[hash].js',
		assetFileNames: 'assets/[name].[hash].[ext]'
	},
	plugins: [
		clean(),

		globImport({
			format: 'import'
		}),

		templateCache({
			templates: './src/views/**/*.html',
			rootDir: './src/views',
			transformHtmlImportsToUris: true
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

		serve({
			port: 8087
		}),

		!production && livereload({ watch: 'dist', delay: 500 }),

		production && terser(),
		
		html({
			template: 'index.html'
		})
	],
	watch: {
		clearScreen: false
	}
};