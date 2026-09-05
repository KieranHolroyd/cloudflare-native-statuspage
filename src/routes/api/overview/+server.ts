import { json } from '@sveltejs/kit';
import { loadOverview } from '$lib/server/overview';
import type { RequestHandler } from './$types';

/** Status page payload for client-side refetches (TanStack Query). */
export const GET: RequestHandler = async ({ locals }) => {
	return json(await loadOverview(locals.env.DB), {
		// never cached: refetches happen on WebSocket pushes and must be fresh
		headers: { 'Cache-Control': 'no-store' }
	});
};
