import { loadOverview } from '$lib/server/overview';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { overview: await loadOverview(locals.env.DB) };
};
