import type { IncidentSeverity, IncidentStatus, IncidentType, Status } from '$lib/status';
import { CLOSED_STATUSES } from '$lib/status';
import type {
	DayUptime,
	Incident,
	IncidentService,
	IncidentUpdate,
	Service,
	ServiceMetrics,
	StatusEvent
} from '$lib/types';

// ── Services ────────────────────────────────────────────────────────────────

export async function listServices(db: D1Database): Promise<Service[]> {
	const { results } = await db
		.prepare(
			'SELECT id, name, description, status, monitorUrl, icon, imageId, sortOrder, updatedAt FROM service ORDER BY sortOrder, name'
		)
		.all<Service>();
	return results;
}

export async function editService(
	db: D1Database,
	serviceId: number,
	name: string,
	description: string | null,
	sortOrder: number
) {
	await db
		.prepare('UPDATE service SET name = ?, description = ?, sortOrder = ? WHERE id = ?')
		.bind(name, description, sortOrder, serviceId)
		.run();
}

export async function setServiceVisual(
	db: D1Database,
	serviceId: number,
	icon: string | null,
	imageId: number | null
) {
	await db
		.prepare('UPDATE service SET icon = ?, imageId = ? WHERE id = ?')
		.bind(icon, imageId, serviceId)
		.run();
}

export async function getServiceImageId(
	db: D1Database,
	serviceId: number
): Promise<number | null> {
	const row = await db
		.prepare('SELECT imageId FROM service WHERE id = ?')
		.bind(serviceId)
		.first<{ imageId: number | null }>();
	return row?.imageId ?? null;
}

export async function recentEvents(db: D1Database, limit = 20): Promise<StatusEvent[]> {
	const { results } = await db
		.prepare(
			`SELECT e.id, e.serviceId, s.name AS serviceName, e.status, e.note, e.createdAt
			 FROM status_event e JOIN service s ON s.id = e.serviceId
			 ORDER BY e.createdAt DESC, e.id DESC LIMIT ?`
		)
		.bind(limit)
		.all<StatusEvent>();
	return results;
}

export async function createService(
	db: D1Database,
	name: string,
	description: string | null,
	monitorUrl: string | null
) {
	await db
		.prepare('INSERT INTO service (name, description, monitorUrl) VALUES (?, ?, ?)')
		.bind(name, description, monitorUrl)
		.run();
}

export async function updateServiceStatus(
	db: D1Database,
	serviceId: number,
	status: Status,
	note: string | null
) {
	await db.batch([
		db
			.prepare(
				`UPDATE service SET status = ?, autoStatus = 0,
				 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
			)
			.bind(status, serviceId),
		db
			.prepare('INSERT INTO status_event (serviceId, status, note) VALUES (?, ?, ?)')
			.bind(serviceId, status, note)
	]);
}

export async function setMonitorUrl(db: D1Database, serviceId: number, monitorUrl: string | null) {
	await db
		.prepare('UPDATE service SET monitorUrl = ? WHERE id = ?')
		.bind(monitorUrl, serviceId)
		.run();
}

export async function deleteService(db: D1Database, serviceId: number) {
	await db.prepare('DELETE FROM service WHERE id = ?').bind(serviceId).run();
}

// ── Incidents ───────────────────────────────────────────────────────────────

const INCIDENT_COLS =
	'id, type, title, severity, status, createdAt, resolvedAt, scheduledStart, scheduledEnd, postmortem';

type IncidentRow = Omit<Incident, 'services' | 'updates'>;

function hydrate(rows: IncidentRow[]): Incident[] {
	return rows.map((r) => ({ ...r, services: [], updates: [] }));
}

async function attachRelations(db: D1Database, incidents: Incident[]): Promise<void> {
	if (incidents.length === 0) return;
	const ids = incidents.map((i) => i.id);
	const marks = ids.map(() => '?').join(',');
	const [updatesRes, servicesRes] = await Promise.all([
		db
			.prepare(
				`SELECT id, incidentId, status, message, createdAt FROM incident_update
				 WHERE incidentId IN (${marks}) ORDER BY createdAt DESC, id DESC`
			)
			.bind(...ids)
			.all<IncidentUpdate>(),
		db
			.prepare(
				`SELECT isv.incidentId, isv.serviceId, s.name AS serviceName, isv.impact
				 FROM incident_service isv JOIN service s ON s.id = isv.serviceId
				 WHERE isv.incidentId IN (${marks}) ORDER BY s.name`
			)
			.bind(...ids)
			.all<IncidentService & { incidentId: number }>()
	]);
	const byId = new Map(incidents.map((i) => [i.id, i]));
	for (const u of updatesRes.results) byId.get(u.incidentId)?.updates.push(u);
	for (const s of servicesRes.results) {
		byId.get(s.incidentId)?.services.push({
			serviceId: s.serviceId,
			serviceName: s.serviceName,
			impact: s.impact
		});
	}
}

export async function listIncidents(
	db: D1Database,
	resolvedLimit = 5
): Promise<{ active: Incident[]; upcoming: Incident[]; resolved: Incident[] }> {
	const { results: rows } = await db
		.prepare(
			`SELECT * FROM (
				SELECT ${INCIDENT_COLS} FROM incident
				WHERE status IN ('investigating', 'identified', 'monitoring', 'in_progress')
				ORDER BY createdAt DESC
			)
			UNION ALL
			SELECT * FROM (
				SELECT ${INCIDENT_COLS} FROM incident
				WHERE status = 'scheduled' ORDER BY scheduledStart
			)
			UNION ALL
			SELECT * FROM (
				SELECT ${INCIDENT_COLS} FROM incident
				WHERE status IN ('resolved', 'completed')
				ORDER BY COALESCE(resolvedAt, createdAt) DESC LIMIT ?
			)`
		)
		.bind(resolvedLimit)
		.all<IncidentRow>();

	const incidents = hydrate(rows);
	await attachRelations(db, incidents);
	return {
		active: incidents.filter(
			(i) => !CLOSED_STATUSES.includes(i.status) && i.status !== 'scheduled'
		),
		upcoming: incidents.filter((i) => i.status === 'scheduled'),
		resolved: incidents.filter((i) => CLOSED_STATUSES.includes(i.status))
	};
}

export async function getIncident(db: D1Database, id: number): Promise<Incident | null> {
	const row = await db
		.prepare(`SELECT ${INCIDENT_COLS} FROM incident WHERE id = ?`)
		.bind(id)
		.first<IncidentRow>();
	if (!row) return null;
	const [incident] = hydrate([row]);
	await attachRelations(db, [incident]);
	return incident;
}

export async function listIncidentHistory(
	db: D1Database,
	page = 1,
	perPage = 25
): Promise<{ incidents: Incident[]; total: number; page: number; pages: number }> {
	const countRow = await db
		.prepare('SELECT COUNT(*) AS c FROM incident')
		.first<{ c: number }>();
	const total = countRow?.c ?? 0;
	const pages = Math.max(1, Math.ceil(total / perPage));
	const current = Math.min(Math.max(1, page), pages);
	const { results: rows } = await db
		.prepare(`SELECT ${INCIDENT_COLS} FROM incident ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
		.bind(perPage, (current - 1) * perPage)
		.all<IncidentRow>();
	const incidents = hydrate(rows);
	await attachRelations(db, incidents);
	return { incidents, total, page: current, pages };
}

export interface CreateIncidentOptions {
	type: IncidentType;
	title: string;
	severity: IncidentSeverity;
	message: string;
	services: { serviceId: number; impact: Status }[];
	scheduledStart?: string | null;
	scheduledEnd?: string | null;
}

export async function createIncident(
	db: D1Database,
	opts: CreateIncidentOptions
): Promise<number> {
	const initialStatus: IncidentStatus = opts.type === 'maintenance' ? 'scheduled' : 'investigating';
	const row = await db
		.prepare(
			`INSERT INTO incident (type, title, severity, status, scheduledStart, scheduledEnd)
			 VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
		)
		.bind(
			opts.type,
			opts.title,
			opts.severity,
			initialStatus,
			opts.scheduledStart ?? null,
			opts.scheduledEnd ?? null
		)
		.first<{ id: number }>();
	if (!row) throw new Error('failed to create incident');

	const statements = [
		db
			.prepare('INSERT INTO incident_update (incidentId, status, message) VALUES (?, ?, ?)')
			.bind(row.id, initialStatus, opts.message)
	];
	for (const s of opts.services) {
		statements.push(
			db
				.prepare('INSERT INTO incident_service (incidentId, serviceId, impact) VALUES (?, ?, ?)')
				.bind(row.id, s.serviceId, s.impact)
		);
	}
	await db.batch(statements);
	return row.id;
}

export async function addIncidentUpdate(
	db: D1Database,
	incidentId: number,
	status: IncidentStatus,
	message: string
) {
	await db.batch([
		db
			.prepare(
				`UPDATE incident SET status = ?,
				 resolvedAt = CASE WHEN ? IN ('resolved', 'completed')
					THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE resolvedAt END
				 WHERE id = ?`
			)
			.bind(status, status, incidentId),
		db
			.prepare('INSERT INTO incident_update (incidentId, status, message) VALUES (?, ?, ?)')
			.bind(incidentId, status, message)
	]);
}

export async function editIncident(
	db: D1Database,
	id: number,
	title: string,
	severity: IncidentSeverity
) {
	await db
		.prepare('UPDATE incident SET title = ?, severity = ? WHERE id = ?')
		.bind(title, severity, id)
		.run();
}

export async function deleteIncident(db: D1Database, id: number) {
	await db.prepare('DELETE FROM incident WHERE id = ?').bind(id).run();
}

export async function deleteIncidentUpdate(db: D1Database, updateId: number) {
	await db.prepare('DELETE FROM incident_update WHERE id = ?').bind(updateId).run();
}

export async function savePostmortem(db: D1Database, id: number, postmortem: string | null) {
	await db.prepare('UPDATE incident SET postmortem = ? WHERE id = ?').bind(postmortem, id).run();
}

/**
 * Move the given services to `to` (recording a public status event each),
 * skipping services already there. `onlyFrom` restricts which current
 * statuses may transition (e.g. maintenance never masks a real outage).
 * Returns whether anything changed.
 */
export async function transitionServices(
	db: D1Database,
	targets: { serviceId: number; to: Status }[],
	note: string,
	onlyFrom?: Status[]
): Promise<boolean> {
	if (targets.length === 0) return false;
	const { results: current } = await db
		.prepare(
			`SELECT id, status FROM service WHERE id IN (${targets.map(() => '?').join(',')})`
		)
		.bind(...targets.map((t) => t.serviceId))
		.all<{ id: number; status: Status }>();
	const statusById = new Map(current.map((r) => [r.id, r.status]));

	const statements = [];
	for (const { serviceId, to } of targets) {
		const from = statusById.get(serviceId);
		if (from === undefined || from === to) continue;
		if (onlyFrom && !onlyFrom.includes(from)) continue;
		statements.push(
			db
				.prepare(
					`UPDATE service SET status = ?, autoStatus = 0,
					 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
				)
				.bind(to, serviceId),
			db
				.prepare('INSERT INTO status_event (serviceId, status, note) VALUES (?, ?, ?)')
				.bind(serviceId, to, note)
		);
	}
	if (statements.length === 0) return false;
	await db.batch(statements);
	return true;
}

// ── Metrics (latency + uptime) ──────────────────────────────────────────────

const BUCKET_SECONDS = 900; // 15-minute buckets for the 24h latency chart
const UPTIME_DAYS = 90;

export async function serviceMetrics(db: D1Database): Promise<Map<number, ServiceMetrics>> {
	// Raw checks only cover the last ~7 days (housekeeping prunes them);
	// history beyond that comes from the uptime_daily aggregates.
	const [latencyRes, dailyRes, todayRes, uptime24hRes, allTimeRes] = await db.batch<
		Record<string, number | string>
	>([
		db.prepare(
			`SELECT serviceId, (strftime('%s', checkedAt) / ${BUCKET_SECONDS}) * ${BUCKET_SECONDS} AS t,
			        AVG(latencyMs) AS avgMs, MAX(latencyMs) AS maxMs, AVG(ok) AS okRate
			 FROM uptime_check
			 WHERE checkedAt >= datetime('now', '-1 day')
			 GROUP BY serviceId, t ORDER BY t`
		),
		db.prepare(
			`SELECT serviceId, day, checks, failures FROM uptime_daily
			 WHERE day >= date('now', '-${UPTIME_DAYS - 1} days')`
		),
		db.prepare(
			// today + yesterday from raw: covers today's partial day and the
			// window between midnight and the daily housekeeping rollup
			`SELECT serviceId, date(checkedAt) AS day, COUNT(*) AS checks, COUNT(*) - SUM(ok) AS failures
			 FROM uptime_check
			 WHERE date(checkedAt) >= date('now', '-1 day')
			 GROUP BY serviceId, date(checkedAt)`
		),
		db.prepare(
			`SELECT serviceId, 100.0 * AVG(ok) AS pct
			 FROM uptime_check
			 WHERE checkedAt >= datetime('now', '-1 day')
			 GROUP BY serviceId`
		),
		db.prepare(
			`SELECT serviceId, SUM(checks) AS checks, SUM(failures) AS failures FROM (
				SELECT serviceId, checks, failures FROM uptime_daily
				UNION ALL
				SELECT serviceId, checks, failures FROM uptime_weekly
			 ) GROUP BY serviceId`
		)
	]);

	const metrics = new Map<number, ServiceMetrics>();
	const ensure = (serviceId: number): ServiceMetrics => {
		let m = metrics.get(serviceId);
		if (!m) {
			m = { uptime24h: null, uptimeAll: null, latency: [], days: emptyDays() };
			metrics.set(serviceId, m);
		}
		return m;
	};

	for (const row of latencyRes.results) {
		ensure(Number(row.serviceId)).latency.push({
			t: Number(row.t),
			avgMs: Math.round(Number(row.avgMs)),
			maxMs: Math.round(Number(row.maxMs)),
			okRate: Number(row.okRate)
		});
	}
	// completed days from aggregates; raw fills only days the rollup hasn't
	// covered yet (today, and yesterday before housekeeping runs)
	const inDaily = new Set(dailyRes.results.map((r) => `${r.serviceId}:${r.day}`));
	for (const row of dailyRes.results) {
		const m = ensure(Number(row.serviceId));
		const day = m.days.find((d) => d.day === row.day);
		const checks = Number(row.checks);
		if (day && checks > 0) day.pct = (100 * (checks - Number(row.failures))) / checks;
	}
	for (const row of todayRes.results) {
		if (inDaily.has(`${row.serviceId}:${row.day}`)) continue;
		const m = ensure(Number(row.serviceId));
		const day = m.days.find((d) => d.day === row.day);
		const checks = Number(row.checks);
		if (day && checks > 0) day.pct = (100 * (checks - Number(row.failures))) / checks;
	}
	for (const row of uptime24hRes.results) {
		ensure(Number(row.serviceId)).uptime24h = Number(row.pct);
	}
	// all-time = daily + weekly aggregates, plus raw days not yet rolled up
	const allTime = new Map<number, { checks: number; failures: number }>();
	const addAllTime = (row: Record<string, number | string>) => {
		const id = Number(row.serviceId);
		const cur = allTime.get(id) ?? { checks: 0, failures: 0 };
		cur.checks += Number(row.checks);
		cur.failures += Number(row.failures);
		allTime.set(id, cur);
	};
	for (const row of allTimeRes.results) addAllTime(row);
	for (const row of todayRes.results) {
		if (!inDaily.has(`${row.serviceId}:${row.day}`)) addAllTime(row);
	}
	for (const [id, { checks, failures }] of allTime) {
		if (checks > 0) ensure(id).uptimeAll = (100 * (checks - failures)) / checks;
	}
	return metrics;
}

function emptyDays(): DayUptime[] {
	const days: DayUptime[] = [];
	const today = new Date();
	for (let i = UPTIME_DAYS - 1; i >= 0; i--) {
		const d = new Date(today.getTime() - i * 86_400_000);
		days.push({ day: d.toISOString().slice(0, 10), pct: null });
	}
	return days;
}
