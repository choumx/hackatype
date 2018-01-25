const path = require('path');
const fs = require('fs');
const WebpackCleanupPlugin = require('webpack-cleanup-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const BabelLoader = {
	test: /\.(js|ts|tsx)$/,
	include: [
		fs.realpathSync('./src'),
	],
	use: {
		loader: 'babel-loader',
		options: {
			cacheDirectory: true,
		},
	},
};

module.exports = [
	{
		entry: {
			app: './src/worker-thread/app.js',
			monkey: './src/worker-thread/monkey.js',
		},
		output: {
			path: path.resolve(__dirname, 'build', 'worker-thread'),
			filename: '[name].js'
		},
		module: {
			rules: [BabelLoader],
		},
		plugins: [
			new WebpackCleanupPlugin({
				exclude: ['.gitignore'],
				quiet: true,
			}),
		],
		devtool: 'source-map',
	},
	{
		entry: {
			main: './src/entry.js',
		},
		output: {
			path: path.resolve(__dirname, 'build'),
			filename: '[name].js',
		},
		module: {
			rules: [BabelLoader],
		},
		devtool: 'source-map',
	}
];
