import { broadcastUpdate } from './realtime';

interface MonitoredService {
	id: number;
	name: string;
	status: string;
	autoStatus: number;
	monitorUrl: string;
}

const CHECK_TIMEOUT_MS = 10_000;

/**
 * Ping every service that has a monitorUrl, record the result, and
 * auto-transition service status:
 *  - two consecutive failures  -> major_outage (marked autoStatus=1)
 *  - success while autoStatus  -> back to operational
 * Manual status changes always clear autoStatus, so the checker never
 * overrides an operator-set status back to operational.
 * Runs from the cron trigger (src/worker.ts) and the dashboard's
 * "Run checks now" button.
 */
export async function runUptimeChecks(env: Env): Promise<{ checked: number; failed: number }> {
	const db = env.DB;
	const { results: services } = await db
		.prepare(
			`SELECT id, name, status, autoStatus, monitorUrl FROM service WHERE monitorUrl IS NOT NULL AND monitorUrl != ''`
		)
		.all<MonitoredService>();

	let failed = 0;
	let anyStatusChange = false;

	// Chunked so a large service list can't exhaust the per-invocation
	// subrequest budget in one burst (each check is a fetch + a few D1 calls).
	const CONCURRENCY = 5;
	const checkService = async (service: MonitoredService) => {
			const result = await checkOnce(service.monitorUrl);
			if (!result.ok) failed++;

			const statements = [
				db
					.prepare(
						'INSERT INTO uptime_check (serviceId, ok, statusCode, latencyMs) VALUES (?, ?, ?, ?)'
					)
					.bind(service.id, result.ok ? 1 : 0, result.statusCode, result.latencyMs)
			];

			if (!result.ok && service.status === 'operational') {
				// require two consecutive failures before declaring an outage
				const previous = await db
					.prepare('SELECT ok FROM uptime_check WHERE serviceId = ? ORDER BY id DESC LIMIT 1')
					.bind(service.id)
					.first<{ ok: number }>();
				if (previous && previous.ok === 0) {
					anyStatusChange = true;
					const note = `Automated: health check failed (${result.statusCode ? `HTTP ${result.statusCode}` : result.error})`;
					statements.push(
						db
							.prepare(
								`UPDATE service SET status = 'major_outage', autoStatus = 1,
								 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
							)
							.bind(service.id),
						db
							.prepare(
								`INSERT INTO status_event (serviceId, status, note) VALUES (?, 'major_outage', ?)`
							)
							.bind(service.id, note)
					);
				}
			} else if (result.ok && service.autoStatus === 1) {
				anyStatusChange = true;
				statements.push(
					db
						.prepare(
							`UPDATE service SET status = 'operational', autoStatus = 0,
							 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
						)
						.bind(service.id),
					db
						.prepare(
							`INSERT INTO status_event (serviceId, status, note)
							 VALUES (?, 'operational', 'Automated: health check recovered')`
						)
						.bind(service.id)
				);
			}

			await db.batch(statements);
	};

	for (let i = 0; i < services.length; i += CONCURRENCY) {
		await Promise.allSettled(services.slice(i, i + CONCURRENCY).map(checkService));
	}

	if (services.length > 0) {
		await broadcastUpdate(env, anyStatusChange ? 'status' : 'checks');
	}
	return { checked: services.length, failed };
}

async function checkOnce(
	url: string
): Promise<{ ok: boolean; statusCode: number | null; latencyMs: number | null; error: string }> {
	const started = Date.now();
	try {
		const response = await fetch(url, {
			redirect: 'follow',
			signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
			headers: { 'User-Agent': 'cloudflare-native-statuspage/1.0 (+uptime-check)' }
		});
		// drain the body so the connection is released
		await response.body?.cancel();
		return {
			ok: response.ok,
			statusCode: response.status,
			latencyMs: Date.now() - started,
			error: ''
		};
	} catch (err) {
		return {
			ok: false,
			statusCode: null,
			latencyMs: null,
			error: err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : 'unreachable'
		};
	}
}
