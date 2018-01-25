const path = require('path');
const fs = require('fs');
const WebpackCleanupPlugin = require('webpack-cleanup-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const BUILD_DIRECTORY = path.resolve(__dirname, 'build');
const devtool = 'source-map';
const modules = {
	rules: [{
		test: /\.(js|ts|tsx)$/,
		use: {
			loader: 'babel-loader',
			options: {
				cacheDirectory: true,
			},
		},
	}],
};

module.exports = [
	{
		entry: {
			app: './src/worker-thread/app.js',
			monkey: './src/worker-thread/monkey.js',
		},
		output: {
			path: path.resolve(BUILD_DIRECTORY, 'worker-thread'),
			filename: '[name].js'
		},
		module: modules,
		plugins: [
			new WebpackCleanupPlugin({
				exclude: ['.gitignore'],
				quiet: true,
			}),
		],
		devtool
	},
	{
		entry: {
			main: './src/entry.js',
		},
		output: {
			path: BUILD_DIRECTORY,
			filename: '[name].js',
		},
		module: modules,
		devtool
	}
];
