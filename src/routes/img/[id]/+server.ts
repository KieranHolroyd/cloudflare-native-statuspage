import { error } from '@sveltejs/kit';
import { getImage } from '$lib/server/images';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Not found');
	const image = await getImage(locals.env.DB, id);
	if (!image) error(404, 'Not found');
	return new Response(image.data, {
		headers: {
			'Content-Type': image.contentType,
			// ids are immutable — replacing an image creates a new id
			'Cache-Control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff',
			// prevents script execution if an SVG is opened directly
			'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
		}
	});
};
