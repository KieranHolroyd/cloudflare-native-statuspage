/**
 * Subscribe to live updates over WebSocket, with automatic reconnection and
 * a polling fallback (for `vite dev`, where the /ws route doesn't exist).
 * Returns an unsubscribe function.
 */
export function subscribeToUpdates(onUpdate: () => void): () => void {
	let ws: WebSocket | null = null;
	let closed = false;
	let attempts = 0;
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let pingTimer: ReturnType<typeof setInterval> | null = null;

	const POLL_INTERVAL = 30_000;

	function startPolling() {
		pollTimer ??= setInterval(onUpdate, POLL_INTERVAL);
	}

	function stopPolling() {
		if (pollTimer) clearInterval(pollTimer);
		pollTimer = null;
	}

	function connect() {
		if (closed) return;
		const proto = location.protocol === 'https:' ? 'wss' : 'ws';
		try {
			ws = new WebSocket(`${proto}://${location.host}/ws`);
		} catch {
			startPolling();
			return;
		}

		ws.onopen = () => {
			attempts = 0;
			stopPolling();
			pingTimer = setInterval(() => ws?.send('ping'), 45_000);
		};
		ws.onmessage = (event) => {
			if (event.data !== 'pong') onUpdate();
		};
		ws.onclose = () => {
			if (pingTimer) clearInterval(pingTimer);
			pingTimer = null;
			if (closed) return;
			startPolling(); // keep data fresh while reconnecting
			attempts++;
			const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5));
			setTimeout(connect, delay);
		};
		ws.onerror = () => ws?.close();
	}

	connect();

	return () => {
		closed = true;
		stopPolling();
		if (pingTimer) clearInterval(pingTimer);
		ws?.close();
	};
}
