import type { Handle } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { createAuth } from '$lib/server/auth';
import { countUsers, isSignupsOpen, validateInvitation } from '$lib/server/access';
import { getOrCreateAuthSecret } from '$lib/server/settings';

// In `vite dev` there is no Cloudflare runtime, so emulate the bindings
// (D1, .dev.vars) with wrangler's platform proxy. In production and in
// `wrangler dev` the real `event.platform` is present and this is skipped.
let devEnv: Env | undefined;
let authSecret: string | undefined;
async function resolveEnv(platform: App.Platform | undefined): Promise<Env> {
	if (platform?.env) return platform.env;
	if (dev) {
		if (!devEnv) {
			const { getPlatformProxy } = await import('wrangler');
			// the adapter config has no Durable Objects, which getPlatformProxy
			// can't emulate for same-worker classes
			devEnv = (await getPlatformProxy<Env>({ configPath: 'wrangler.adapter.jsonc' })).env;
		}
		return devEnv;
	}
	throw new Error('No Cloudflare platform bindings available');
}

function readCookie(header: string | null, name: string): string | null {
	if (!header) return null;
	for (const part of header.split(';')) {
		const eq = part.indexOf('=');
		if (eq === -1) continue;
		if (part.slice(0, eq).trim() === name) {
			return decodeURIComponent(part.slice(eq + 1).trim());
		}
	}
	return null;
}

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const env = await resolveEnv(event.platform);
	const db = env.DB;
	event.locals.env = env;

	const path = event.url.pathname;

	// Sign-up policy, decided per-request for the sign-up endpoint only:
	// the very first account (onboarding) is always allowed; after that,
	// sign-ups require the open-signups setting or a valid invitation cookie
	// (set by /invite/[token]).
	let disableSignUp = false;
	let inviteToken: string | null = null;
	if (path === '/api/auth/sign-up/email' && event.request.method === 'POST') {
		if ((await countUsers(db)) > 0 && !(await isSignupsOpen(db))) {
			const token = readCookie(event.request.headers.get('cookie'), 'invite_token');
			if (token && (await validateInvitation(db, token))) {
				inviteToken = token;
			} else {
				disableSignUp = true;
			}
		}
	}

	// One-click deploys have no BETTER_AUTH_SECRET secret set — self-provision
	// one into the settings table (cached per isolate).
	authSecret ??= env.BETTER_AUTH_SECRET || (await getOrCreateAuthSecret(db));
	const auth = createAuth(env, { disableSignUp, inviteToken }, authSecret);
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	// First-run onboarding: until an account exists, every page is the setup page.
	const isPage = !path.startsWith('/api/') && path !== '/ws';
	if (isPage) {
		const hasUsers = event.locals.user !== null || (await countUsers(db)) > 0;
		if (!hasUsers && path !== '/onboarding') {
			return Response.redirect(new URL('/onboarding', event.url).toString(), 303);
		}
		if (hasUsers && path === '/onboarding') {
			return Response.redirect(new URL('/', event.url).toString(), 303);
		}
	}

	const response = await svelteKitHandler({ event, resolve, auth, building });
	try {
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
		response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	} catch {
		// immutable headers (e.g. websocket upgrade responses)
	}
	return response;
};
