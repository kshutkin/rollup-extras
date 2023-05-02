const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const styles = require('rollup-plugin-styles');
const templateCache = require('@rollup-extras/plugin-angularjs-template-cache');
const globImport = require('rollup-plugin-glob-import');

module.exports = function (config) {
	config.set({
		basePath: '',
		frameworks: ['jasmine'],
		files: [
			{ pattern: 'test-bundle.js', watched: false },
		],
		singleRun: true,
		browsers: ['ChromeHeadless'],
		preprocessors: {			
			'test-bundle.js': ['rollup']
		},
		plugins: [
			'karma-chrome-launcher',
			'karma-jasmine',
			'karma-rollup-preprocessor'
		],
		rollupPreprocessor: {
			plugins: [
				globImport({
					format: 'import'
				}),
				
				templateCache({
					templates: './src/views/**/*.html',
					rootDir: './src/views'
				}),
		
				styles({
					mode: "extract",
					sourceMap: 'inline',
					plugins: []
				}),
		
				resolve({
					browser: true
				}),
		
				commonjs()
			],
			output: {
				format: 'iife',
				name: 'test',
				sourcemap: 'inline',
				dir: 'dist'
			},
		},
	});
};
