import { redirect } from '@sveltejs/kit';
import { validateInvitation } from '$lib/server/access';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
	if (locals.user) redirect(303, '/dashboard');

	const invitation = await validateInvitation(locals.env.DB, params.token);
	if (!invitation) {
		return { valid: false as const };
	}

	// The sign-up endpoint (see hooks.server.ts) honors this cookie, so the
	// invited person can create an account while sign-ups are closed.
	cookies.set('invite_token', params.token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 // plenty of time to fill in the form
	});

	return { valid: true as const, note: invitation.note, expiresAt: invitation.expiresAt };
};
