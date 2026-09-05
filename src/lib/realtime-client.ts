/**
 * Subscribe to live updates over WebSocket with automatic reconnection.
 * `onUpdate` fires on every server push; `onStatus` reports whether the
 * socket is live (when it isn't, the caller's poller — TanStack Query's
 * refetchInterval — keeps data fresh). Returns an unsubscribe function.
 */
export function subscribeToUpdates(
	onUpdate: () => void,
	onStatus: (live: boolean) => void = () => {}
): () => void {
	let ws: WebSocket | null = null;
	let closed = false;
	let attempts = 0;
	let pingTimer: ReturnType<typeof setInterval> | null = null;

	function connect() {
		if (closed) return;
		const proto = location.protocol === 'https:' ? 'wss' : 'ws';
		try {
			ws = new WebSocket(`${proto}://${location.host}/ws`);
		} catch {
			onStatus(false);
			return;
		}

		ws.onopen = () => {
			attempts = 0;
			onStatus(true);
			pingTimer = setInterval(() => ws?.send('ping'), 45_000);
		};
		ws.onmessage = (event) => {
			if (event.data !== 'pong') onUpdate();
		};
		ws.onclose = () => {
			if (pingTimer) clearInterval(pingTimer);
			pingTimer = null;
			onStatus(false);
			if (closed) return;
			attempts++;
			const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5));
			setTimeout(connect, delay);
		};
		ws.onerror = () => ws?.close();
	}

	connect();

	return () => {
		closed = true;
		if (pingTimer) clearInterval(pingTimer);
		ws?.close();
	};
}
