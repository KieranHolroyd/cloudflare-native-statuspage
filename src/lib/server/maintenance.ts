import { broadcastUpdate } from './realtime';
import { addIncidentUpdate, getIncident, transitionServices } from './statuspage';

/**
 * Advance maintenance windows past their scheduled boundaries:
 *  - scheduled + start time passed  -> in_progress, affected services -> maintenance
 *  - in_progress + end time passed  -> completed, affected services restored
 * Services are only flipped to maintenance from `operational` (a real outage is
 * never masked) and only restored from `maintenance` (operator changes stick).
 * Runs from the cron trigger and the dashboard's "Run checks now" button.
 */
export async function runMaintenanceTransitions(env: Env): Promise<number> {
	const db = env.DB;
	const now = new Date().toISOString();
	const { results: due } = await db
		.prepare(
			`SELECT id, status FROM incident WHERE type = 'maintenance' AND (
				(status = 'scheduled' AND scheduledStart IS NOT NULL AND scheduledStart <= ?)
				OR (status = 'in_progress' AND scheduledEnd IS NOT NULL AND scheduledEnd <= ?)
			)`
		)
		.bind(now, now)
		.all<{ id: number; status: 'scheduled' | 'in_progress' }>();

	for (const row of due) {
		const incident = await getIncident(db, row.id);
		if (!incident) continue;
		if (row.status === 'scheduled') {
			await addIncidentUpdate(db, row.id, 'in_progress', 'Maintenance window has started.');
			await transitionServices(
				db,
				incident.services.map((s) => ({ serviceId: s.serviceId, to: 'maintenance' })),
				`Scheduled maintenance: ${incident.title}`,
				['operational']
			);
		} else {
			await addIncidentUpdate(db, row.id, 'completed', 'Maintenance window has ended.');
			await transitionServices(
				db,
				incident.services.map((s) => ({ serviceId: s.serviceId, to: 'operational' })),
				`Maintenance completed: ${incident.title}`,
				['maintenance']
			);
		}
	}

	if (due.length > 0) await broadcastUpdate(env, 'incidents');
	return due.length;
}
