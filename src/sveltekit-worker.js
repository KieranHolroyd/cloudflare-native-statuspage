// Re-export the SvelteKit-generated worker. The sibling .d.ts gives this
// module its types so the (huge, generated) _worker.js is never type-checked.
export { default } from '../.svelte-kit/cloudflare/_worker.js';
