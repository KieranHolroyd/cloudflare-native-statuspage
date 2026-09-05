import { listIncidents, listServices, recentEvents, serviceMetrics } from '$lib/server/statuspage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = locals.env.DB;
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
		// Map isn't serializable across the server/client boundary
		metrics: Object.fromEntries(metrics)
	};
};
