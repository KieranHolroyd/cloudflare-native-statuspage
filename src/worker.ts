/**
 * Custom Worker entry. The SvelteKit Cloudflare adapter only produces a
 * `fetch` handler, so this wraps it to add:
 *  - the /ws WebSocket route (handled by the StatusChannel Durable Object)
 *  - the cron `scheduled` handler that runs uptime checks
 *  - the Durable Object class export
 *
 * The adapter writes its own worker to the `main` of whatever wrangler config
 * it reads, which is why it gets a separate config (wrangler.adapter.jsonc) —
 * otherwise it would overwrite this file. Run `npm run build` before
 * `wrangler dev`/`deploy` so the imported SvelteKit output exists.
 */
import svelteKit from './sveltekit-worker.js';
import { runUptimeChecks } from './lib/server/checks';
import { runHousekeeping } from './lib/server/housekeeping';
import { runMaintenanceTransitions } from './lib/server/maintenance';

const HOUSEKEEPING_CRON = '13 3 * * *';

export { StatusChannel } from './lib/server/status-channel';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (url.pathname === '/ws') {
			const stub = env.STATUS_CHANNEL.get(env.STATUS_CHANNEL.idFromName('global'));
			return stub.fetch(request);
		}
		return svelteKit.fetch(request, env, ctx);
	},

	async scheduled(controller, env, ctx) {
		if (controller.cron === HOUSEKEEPING_CRON) {
			ctx.waitUntil(runHousekeeping(env));
		} else {
			ctx.waitUntil(
				Promise.allSettled([runUptimeChecks(env), runMaintenanceTransitions(env)])
			);
		}
	}
} satisfies ExportedHandler<Env>;
