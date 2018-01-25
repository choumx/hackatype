import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';

const plugins = [
	babel({
		exclude: 'node_modules/**'
	}),
	resolve(),
	commonjs()
];

export default [
	{
		input: 'src/worker-thread/app.js',
		output: {
			file: 'build/worker-thread/app.js',
			format: 'iife',
			sourcemap: true,
		},
		plugins
	},
	{
		input: 'src/worker-thread/monkey.js',
		output: {
			file: 'build/worker-thread/monkey.js',
			format: 'iife',
			sourcemap: true,
		},
		plugins
	},
	{
		input: 'src/entry.js',
		output: {
			file: 'build/entry.js',
			format: 'iife',
			sourcemap: true,
		},
		plugins
	}
];
