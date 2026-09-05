import { getSiteSettings } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		site: await getSiteSettings(locals.env.DB)
	};
};
