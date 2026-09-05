import type { SessionData } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			env: Env;
			user: SessionData['user'] | null;
			session: SessionData['session'] | null;
		}
		interface Platform {
			env: Env;
			cf: CfProperties;
			ctx: ExecutionContext;
		}
	}
}

export {};
