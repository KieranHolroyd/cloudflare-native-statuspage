import { betterAuth } from 'better-auth';
import { D1Dialect } from 'kysely-d1';
import { markInvitationUsed } from './access';

export interface AuthPolicy {
	/** Block the sign-up endpoint (computed per-request in hooks.server.ts). */
	disableSignUp: boolean;
	/** Valid invitation token to consume if this request creates a user. */
	inviteToken: string | null;
}

const DEFAULT_POLICY: AuthPolicy = { disableSignUp: false, inviteToken: null };

export function createAuth(env: Env, policy: AuthPolicy = DEFAULT_POLICY, secret?: string) {
	return betterAuth({
		database: {
			dialect: new D1Dialect({ database: env.DB }),
			type: 'sqlite'
		},
		secret: secret ?? env.BETTER_AUTH_SECRET,
		emailAndPassword: {
			enabled: true,
			disableSignUp: policy.disableSignUp
		},
		session: {
			cookieCache: {
				enabled: true,
				maxAge: 60 // avoid a D1 read on every request
			}
		},
		databaseHooks: {
			user: {
				create: {
					after: async (user) => {
						if (policy.inviteToken) {
							await markInvitationUsed(env.DB, policy.inviteToken, user.email);
						}
					}
				}
			}
		}
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionData = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;
