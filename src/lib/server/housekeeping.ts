/**
 * Daily housekeeping so the database stays small forever. Retention policy:
 *  - raw uptime checks: rolled up into uptime_daily (kept forever), raw kept 7 days
 *  - public status events: 365 days
 *  - auth sessions / verifications: dropped once expired
 *  - invitations: dropped 30 days after being used or expiring
 *  - images: dropped when nothing references them
 * Incidents, their timelines, and daily uptime aggregates are permanent
 * history — they grow by human action, not by the clock.
 */

const RAW_CHECK_RETENTION_DAYS = 7;
const STATUS_EVENT_RETENTION_DAYS = 365;
const INVITATION_GRACE_DAYS = 30;

export interface HousekeepingSummary {
	prunedChecks: number;
	prunedEvents: number;
	prunedSessions: number;
	prunedVerifications: number;
	prunedInvitations: number;
	prunedImages: number;
}

export async function runHousekeeping(env: Env): Promise<HousekeepingSummary> {
	const db = env.DB;

	// finalize completed days into the aggregate table (idempotent upsert)
	await db
		.prepare(
			`INSERT INTO uptime_daily (serviceId, day, checks, failures, avgLatencyMs, maxLatencyMs)
			 SELECT serviceId, date(checkedAt), COUNT(*), COUNT(*) - SUM(ok),
			        CAST(ROUND(AVG(latencyMs)) AS INTEGER), MAX(latencyMs)
			 FROM uptime_check
			 WHERE date(checkedAt) < date('now')
			 GROUP BY serviceId, date(checkedAt)
			 ON CONFLICT(serviceId, day) DO UPDATE SET
			   checks = excluded.checks,
			   failures = excluded.failures,
			   avgLatencyMs = excluded.avgLatencyMs,
			   maxLatencyMs = excluded.maxLatencyMs`
		)
		.run();

	const [checks, events, sessions, verifications, invitations, images] = await db.batch([
		db.prepare(
			`DELETE FROM uptime_check WHERE checkedAt < datetime('now', '-${RAW_CHECK_RETENTION_DAYS} days')`
		),
		db.prepare(
			`DELETE FROM status_event WHERE createdAt < datetime('now', '-${STATUS_EVENT_RETENTION_DAYS} days')`
		),
		db.prepare(`DELETE FROM session WHERE expiresAt < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`),
		db.prepare(
			`DELETE FROM verification WHERE expiresAt < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
		),
		db.prepare(
			`DELETE FROM invitation
			 WHERE COALESCE(usedAt, expiresAt) < datetime('now', '-${INVITATION_GRACE_DAYS} days')`
		),
		db.prepare(
			`DELETE FROM image WHERE id NOT IN (
				SELECT imageId FROM service WHERE imageId IS NOT NULL
			 ) AND CAST(id AS TEXT) NOT IN (
				SELECT value FROM setting WHERE key = 'siteImageId'
			 )`
		)
	]);

	return {
		prunedChecks: checks.meta.changes ?? 0,
		prunedEvents: events.meta.changes ?? 0,
		prunedSessions: sessions.meta.changes ?? 0,
		prunedVerifications: verifications.meta.changes ?? 0,
		prunedInvitations: invitations.meta.changes ?? 0,
		prunedImages: images.meta.changes ?? 0
	};
}
