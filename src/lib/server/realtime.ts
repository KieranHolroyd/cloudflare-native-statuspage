/**
 * Notify all connected WebSocket clients that something changed.
 * Safe to call anywhere: in `vite dev` the Durable Object binding isn't
 * available, so failures are swallowed (clients poll as a fallback anyway).
 */
export async function broadcastUpdate(env: Env, type: string): Promise<void> {
	try {
		const stub = env.STATUS_CHANNEL.get(env.STATUS_CHANNEL.idFromName('global'));
		await stub.broadcast(JSON.stringify({ type, at: new Date().toISOString() }));
	} catch {
		// no realtime channel available (vite dev) — clients fall back to polling
	}
}
