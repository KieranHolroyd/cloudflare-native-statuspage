import { error } from '@sveltejs/kit';
import { getIncident } from '$lib/server/statuspage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Not found');
	const incident = await getIncident(locals.env.DB, id);
	if (!incident) error(404, 'Not found');
	return { incident };
};
