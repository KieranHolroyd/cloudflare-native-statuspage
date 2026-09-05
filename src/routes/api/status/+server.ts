import { json } from '@sveltejs/kit';
import { getSiteSettings } from '$lib/server/settings';
import { listIncidents, listServices } from '$lib/server/statuspage';
import type { RequestHandler } from './$types';

/** Public machine-readable status, CORS-open for badges and monitors. */
export const GET: RequestHandler = async ({ locals }) => {
	const db = locals.env.DB;
	const [site, services, incidents] = await Promise.all([
		getSiteSettings(db),
		listServices(db),
		listIncidents(db, 0)
	]);
	const operational =
		services.every((s) => s.status === 'operational') && incidents.active.length === 0;

	return json(
		{
			name: site.title,
			status: operational ? 'operational' : 'issues',
			services: services.map((s) => ({ name: s.name, status: s.status })),
			activeIncidents: incidents.active.map((i) => ({
				id: i.id,
				type: i.type,
				title: i.title,
				severity: i.severity,
				status: i.status,
				createdAt: i.createdAt
			})),
			upcomingMaintenance: incidents.upcoming.map((i) => ({
				id: i.id,
				title: i.title,
				scheduledStart: i.scheduledStart,
				scheduledEnd: i.scheduledEnd
			}))
		},
		{
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Cache-Control': 'public, max-age=60'
			}
		}
	);
};
