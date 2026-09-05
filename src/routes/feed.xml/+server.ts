import { getSiteSettings } from '$lib/server/settings';
import { listIncidentHistory } from '$lib/server/statuspage';
import { INCIDENT_STATUSES } from '$lib/status';
import type { RequestHandler } from './$types';

function esc(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/** RSS feed of incidents & maintenance — the zero-maintenance subscription channel. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const [site, history] = await Promise.all([
		getSiteSettings(locals.env.DB),
		listIncidentHistory(locals.env.DB, 1, 50)
	]);

	const items = history.incidents
		.map((incident) => {
			const link = `${url.origin}/incident/${incident.id}`;
			const latest = incident.updates[0];
			const description = latest
				? `[${INCIDENT_STATUSES[latest.status].label}] ${latest.message}`
				: INCIDENT_STATUSES[incident.status].label;
			const updated = latest?.createdAt ?? incident.createdAt;
			return `<item>
<title>${esc(incident.title)}</title>
<link>${esc(link)}</link>
<guid isPermaLink="true">${esc(link)}</guid>
<pubDate>${new Date(updated).toUTCString()}</pubDate>
<description>${esc(description)}</description>
</item>`;
		})
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${esc(site.title)} — incidents</title>
<link>${esc(url.origin)}</link>
<description>${esc(site.description || 'Incident history')}</description>
${items}
</channel>
</rss>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=300'
		}
	});
};
