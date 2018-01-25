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
		input: 'src/author/app.js',
		output: {
			file: 'build/author/app.js',
			format: 'iife',
			sourcemap: true,
		},
		plugins
	},
	// {
	// 	input: 'src/worker-thread/monkey.js',
	// 	output: {
	// 		file: 'build/worker-thread/monkey.js',
	// 		format: 'iife',
	// 		sourcemap: true,
	// 	},
	// 	plugins
	// },
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

// We need to globally replace __REQUIRE_GESTURE_TO_MUTATE__ with a boolean value.