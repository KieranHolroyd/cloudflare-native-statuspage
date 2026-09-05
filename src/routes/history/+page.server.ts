import { listIncidentHistory } from '$lib/server/statuspage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const page = Number(url.searchParams.get('page')) || 1;
	const history = await listIncidentHistory(locals.env.DB, page, 25);
	return { history };
};
