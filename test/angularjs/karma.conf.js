module.exports = function (config) {
	config.set({
		basePath: '',
		frameworks: ['jasmine'],
		files: [
			'dist/test-bundle.js'
		],
		autoWatch: true,
		singleRun: false,
		browsers: ['Chrome'],
		plugins: [
			'karma-chrome-launcher',
			'karma-jasmine'
		],
	});
};
