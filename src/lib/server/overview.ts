import { listIncidents, listServices, recentEvents, serviceMetrics } from './statuspage';
import type { Overview } from '$lib/types';

/**
 * The full public status page payload. Used by the SSR load (initial data)
 * and by /api/overview (TanStack Query refetches).
 */
export async function loadOverview(db: D1Database): Promise<Overview> {
	const [services, events, incidents, metrics] = await Promise.all([
		listServices(db),
		recentEvents(db, 15),
		listIncidents(db, 5),
		serviceMetrics(db)
	]);
	return {
		services,
		events,
		incidents,
		// Map isn't JSON-serializable
		metrics: Object.fromEntries(metrics)
	};
}
