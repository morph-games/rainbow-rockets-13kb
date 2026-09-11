import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		minify: 'oxc',
		modulePreload: {
			polyfill: false,
		},
		target: 'esnext',
	}
});
