import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Separate config so the adapter's generated worker doesn't overwrite
			// src/worker.ts (the adapter emits to its config's `main`).
			adapter: adapter({ config: 'wrangler.adapter.jsonc' })
		})
	]
});
