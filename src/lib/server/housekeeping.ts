/**
 * Daily housekeeping so the database stays near-constant in size forever.
 *
 * Uptime data flows through tiers, each an exact sum-based rollup of the one
 * below, so total rows are bounded with only the weekly tier growing
 * (~52 rows/service/year):
 *
 *   raw checks (per minute)  kept 7 days    -> rolled into hourly
 *   uptime_hourly            kept 30 days   -> rolled into daily
 *   uptime_daily             kept ~1 year   -> rolled into weekly
 *   uptime_weekly            kept forever
 *
 * Also pruned: public status events after 1 year, expired auth
 * sessions/verifications, invitations 30 days past use/expiry, and
 * unreferenced images. Incidents and their timelines are permanent history —
 * they grow by human action, not by the clock.
 */

const RAW_RETENTION_DAYS = 7;
const HOURLY_RETENTION_DAYS = 30;
// weeks are rolled up only once every day of the week is past this boundary,
// so the daily->weekly upsert is a one-shot overwrite (idempotent)
const DAILY_RETENTION_DAYS = 371; // 365 + a full week of margin
const STATUS_EVENT_RETENTION_DAYS = 365;
const INVITATION_GRACE_DAYS = 30;

export interface HousekeepingSummary {
	prunedChecks: number;
	prunedHourly: number;
	rolledWeeks: number;
	prunedEvents: number;
	prunedSessions: number;
	prunedVerifications: number;
	prunedInvitations: number;
	prunedImages: number;
}

export async function runHousekeeping(env: Env): Promise<HousekeepingSummary> {
	const db = env.DB;

	// Correctness invariant: rollups are UNBOUNDED on the old side (so nothing
	// is ever pruned before being rolled up, even after a long cron outage),
	// and prunes cut strictly on period boundaries (whole hours / whole days /
	// whole weeks). A source period is therefore always either fully present
	// (re-aggregation produces the same values) or fully absent (no row, no
	// overwrite) — never partial.

	// 1. raw -> hourly, for all completed hours
	await db
		.prepare(
			`INSERT INTO uptime_hourly (serviceId, hour, checks, failures, latencySamples, sumLatencyMs, maxLatencyMs)
			 SELECT serviceId, strftime('%Y-%m-%dT%H:00', checkedAt), COUNT(*), COUNT(*) - SUM(ok),
			        SUM(latencyMs IS NOT NULL), COALESCE(SUM(latencyMs), 0), MAX(latencyMs)
			 FROM uptime_check
			 WHERE strftime('%Y-%m-%dT%H:00', checkedAt) < strftime('%Y-%m-%dT%H:00', 'now')
			 GROUP BY serviceId, strftime('%Y-%m-%dT%H:00', checkedAt)
			 ON CONFLICT(serviceId, hour) DO UPDATE SET
			   checks = excluded.checks, failures = excluded.failures,
			   latencySamples = excluded.latencySamples, sumLatencyMs = excluded.sumLatencyMs,
			   maxLatencyMs = excluded.maxLatencyMs`
		)
		.run();

	// 2. hourly -> daily, for all completed days
	await db
		.prepare(
			`INSERT INTO uptime_daily (serviceId, day, checks, failures, latencySamples, sumLatencyMs, maxLatencyMs)
			 SELECT serviceId, date(hour), SUM(checks), SUM(failures),
			        SUM(latencySamples), SUM(sumLatencyMs), MAX(maxLatencyMs)
			 FROM uptime_hourly
			 WHERE date(hour) < date('now')
			 GROUP BY serviceId, date(hour)
			 ON CONFLICT(serviceId, day) DO UPDATE SET
			   checks = excluded.checks, failures = excluded.failures,
			   latencySamples = excluded.latencySamples, sumLatencyMs = excluded.sumLatencyMs,
			   maxLatencyMs = excluded.maxLatencyMs`
		)
		.run();

	// 3. daily -> weekly, for whole weeks past the daily retention window
	const rolledWeeks = await db
		.prepare(
			`INSERT INTO uptime_weekly (serviceId, week, checks, failures, latencySamples, sumLatencyMs, maxLatencyMs)
			 SELECT serviceId, date(day, '-6 days', 'weekday 1'), SUM(checks), SUM(failures),
			        SUM(latencySamples), SUM(sumLatencyMs), MAX(maxLatencyMs)
			 FROM uptime_daily
			 WHERE date(day, '-6 days', 'weekday 1') < date('now', '-${DAILY_RETENTION_DAYS} days')
			 GROUP BY serviceId, date(day, '-6 days', 'weekday 1')
			 ON CONFLICT(serviceId, week) DO UPDATE SET
			   checks = excluded.checks, failures = excluded.failures,
			   latencySamples = excluded.latencySamples, sumLatencyMs = excluded.sumLatencyMs,
			   maxLatencyMs = excluded.maxLatencyMs`
		)
		.run();

	const [checks, hourly, , events, sessions, verifications, invitations, images] =
		await db.batch([
			db.prepare(
				// hour-aligned cut, matching the rollup source window above
				`DELETE FROM uptime_check WHERE checkedAt < strftime('%Y-%m-%dT%H:00', datetime('now', '-${RAW_RETENTION_DAYS} days'))`
			),
			db.prepare(
				// day-aligned cut, matching the rollup source window above
				`DELETE FROM uptime_hourly WHERE date(hour) < date('now', '-${HOURLY_RETENTION_DAYS} days')`
			),
			db.prepare(
				`DELETE FROM uptime_daily WHERE date(day, '-6 days', 'weekday 1') < date('now', '-${DAILY_RETENTION_DAYS} days')`
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
		prunedHourly: hourly.meta.changes ?? 0,
		rolledWeeks: rolledWeeks.meta.changes ?? 0,
		prunedEvents: events.meta.changes ?? 0,
		prunedSessions: sessions.meta.changes ?? 0,
		prunedVerifications: verifications.meta.changes ?? 0,
		prunedInvitations: invitations.meta.changes ?? 0,
		prunedImages: images.meta.changes ?? 0
	};
}
