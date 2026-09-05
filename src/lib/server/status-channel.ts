import { DurableObject } from 'cloudflare:workers';

/**
 * A single global broadcast channel. Public pages connect via WebSocket at
 * /ws (routed here by src/worker.ts); any mutation broadcasts a message that
 * tells connected clients to refetch. Uses the hibernation API so idle
 * sockets don't keep the DO (or billing) alive.
 *
 * Only import this from src/worker.ts — it depends on `cloudflare:workers`,
 * which doesn't exist in the vite dev server.
 */
export class StatusChannel extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
			return new Response('Expected a WebSocket upgrade', { status: 426 });
		}
		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1]);
		return new Response(null, { status: 101, webSocket: pair[0] });
	}

	broadcast(message: string) {
		for (const ws of this.ctx.getWebSockets()) {
			try {
				ws.send(message);
			} catch {
				// socket already gone
			}
		}
	}

	webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		// keepalive: reply to client pings so intermediaries keep the socket open
		if (message === 'ping') ws.send('pong');
	}

	webSocketClose(ws: WebSocket) {
		ws.close();
	}
}
