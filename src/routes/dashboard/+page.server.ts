import { error, fail, redirect } from '@sveltejs/kit';
import {
	STATUS_FLOWS,
	isImpactLevel,
	isIncidentSeverity,
	isIncidentStatus,
	isStatus
} from '$lib/status';
import {
	createInvitation,
	isSignupsOpen,
	listInvitations,
	listUsers,
	revokeInvitation,
	setSignupsOpen
} from '$lib/server/access';
import { isIconName } from '$lib/icons';
import { runUptimeChecks } from '$lib/server/checks';
import { deleteImage, saveImage } from '$lib/server/images';
import { runMaintenanceTransitions } from '$lib/server/maintenance';
import { broadcastUpdate } from '$lib/server/realtime';
import { getSiteSettings, setSetting } from '$lib/server/settings';
import {
	addIncidentUpdate,
	createIncident,
	createService,
	deleteIncident,
	deleteIncidentUpdate,
	deleteService,
	editIncident,
	editService,
	getIncident,
	getServiceImageId,
	listIncidents,
	listServices,
	savePostmortem,
	setMonitorUrl,
	setServiceVisual,
	transitionServices,
	updateServiceStatus
} from '$lib/server/statuspage';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	const db = locals.env.DB;
	const [services, incidents, signupsOpen, invitations, users] = await Promise.all([
		listServices(db),
		listIncidents(db, 5),
		isSignupsOpen(db),
		listInvitations(db),
		listUsers(db)
	]);
	return { services, incidents, signupsOpen, invitations, users };
};

function requireUser(locals: App.Locals) {
	if (!locals.user) error(401);
}

function validUrl(value: string): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return url.toString();
	} catch {
		return null;
	}
}

export const actions: Actions = {
	create: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const monitorRaw = String(form.get('monitorUrl') ?? '').trim();
		if (!name) return fail(400, { message: 'Service name is required' });
		const monitorUrl = validUrl(monitorRaw);
		if (monitorRaw && !monitorUrl) {
			return fail(400, { message: 'Monitor URL must be a valid http(s) URL' });
		}
		await createService(locals.env.DB, name, description || null, monitorUrl);
		await broadcastUpdate(locals.env, 'services');
	},

	editService: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = Number(form.get('id'));
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const sortOrder = Number(form.get('sortOrder'));
		if (!Number.isInteger(id) || !name || !Number.isInteger(sortOrder)) {
			return fail(400, { message: 'Service needs a name and a whole-number sort order' });
		}
		await editService(locals.env.DB, id, name, description || null, sortOrder);
		await broadcastUpdate(locals.env, 'services');
	},

	updateStatus: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = Number(form.get('id'));
		const status = form.get('status');
		const note = String(form.get('note') ?? '').trim();
		if (!Number.isInteger(id) || !isStatus(status)) {
			return fail(400, { message: 'Invalid status update' });
		}
		await updateServiceStatus(locals.env.DB, id, status, note || null);
		await broadcastUpdate(locals.env, 'status');
	},

	setMonitor: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = Number(form.get('id'));
		const monitorRaw = String(form.get('monitorUrl') ?? '').trim();
		if (!Number.isInteger(id)) return fail(400, { message: 'Invalid service' });
		const monitorUrl = validUrl(monitorRaw);
		if (monitorRaw && !monitorUrl) {
			return fail(400, { message: 'Monitor URL must be a valid http(s) URL' });
		}
		await setMonitorUrl(locals.env.DB, id, monitorUrl);
		await broadcastUpdate(locals.env, 'services');
	},

	delete: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isInteger(id)) return fail(400, { message: 'Invalid service' });
		await deleteService(locals.env.DB, id);
		await broadcastUpdate(locals.env, 'services');
	},

	runChecks: async ({ locals }) => {
		requireUser(locals);
		const [result, transitions] = await Promise.all([
			runUptimeChecks(locals.env),
			runMaintenanceTransitions(locals.env)
		]);
		return {
			message:
				`Checked ${result.checked} service${result.checked === 1 ? '' : 's'}, ` +
				`${result.failed} failure${result.failed === 1 ? '' : 's'}` +
				(transitions > 0 ? `, ${transitions} maintenance transition(s)` : '')
		};
	},

	openIncident: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const message = String(form.get('message') ?? '').trim();
		const severity = form.get('severity');
		const impact = form.get('impact');
		const cascade = form.get('cascade') === 'on';
		const serviceIds = form
			.getAll('services')
			.map(Number)
			.filter((n) => Number.isInteger(n));
		if (!title || !message || !isIncidentSeverity(severity) || severity === 'maintenance') {
			return fail(400, { message: 'Incident title, severity and initial update are required' });
		}
		if (!isImpactLevel(impact)) return fail(400, { message: 'Invalid impact level' });

		await createIncident(locals.env.DB, {
			type: 'incident',
			title,
			severity,
			message,
			services: serviceIds.map((serviceId) => ({ serviceId, impact }))
		});
		if (cascade && serviceIds.length > 0) {
			await transitionServices(
				locals.env.DB,
				serviceIds.map((serviceId) => ({ serviceId, to: impact })),
				`Incident: ${title}`
			);
		}
		await broadcastUpdate(locals.env, 'incidents');
	},

	scheduleMaintenance: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const message = String(form.get('message') ?? '').trim() || 'Maintenance has been scheduled.';
		const start = String(form.get('scheduledStart') ?? '');
		const end = String(form.get('scheduledEnd') ?? '');
		const serviceIds = form
			.getAll('services')
			.map(Number)
			.filter((n) => Number.isInteger(n));
		if (!title) return fail(400, { message: 'Maintenance title is required' });
		if (
			Number.isNaN(Date.parse(start)) ||
			Number.isNaN(Date.parse(end)) ||
			Date.parse(end) <= Date.parse(start)
		) {
			return fail(400, { message: 'Maintenance needs a valid start and end (end after start)' });
		}

		await createIncident(locals.env.DB, {
			type: 'maintenance',
			title,
			severity: 'maintenance',
			message,
			services: serviceIds.map((serviceId) => ({ serviceId, impact: 'maintenance' })),
			scheduledStart: new Date(start).toISOString(),
			scheduledEnd: new Date(end).toISOString()
		});
		await broadcastUpdate(locals.env, 'incidents');
	},

	toggleSignups: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		await setSignupsOpen(locals.env.DB, form.get('open') === '1');
	},

	createInvite: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const note = String(form.get('note') ?? '').trim();
		await createInvitation(locals.env.DB, note || null, locals.user!.email);
	},

	revokeInvite: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const token = String(form.get('token') ?? '');
		if (!token) return fail(400, { message: 'Invalid invitation' });
		await revokeInvitation(locals.env.DB, token);
	},

	updateIncident: async ({ locals, request }) => {
		requireUser(locals);
		const db = locals.env.DB;
		const form = await request.formData();
		const id = Number(form.get('id'));
		const status = form.get('status');
		const message = String(form.get('message') ?? '').trim();
		const restore = form.get('restore') === 'on';
		if (!Number.isInteger(id) || !isIncidentStatus(status) || !message) {
			return fail(400, { message: 'Incident update needs a status and a message' });
		}
		const incident = await getIncident(db, id);
		if (!incident) return fail(404, { message: 'Incident not found' });
		if (!STATUS_FLOWS[incident.type].includes(status)) {
			return fail(400, { message: `Invalid status for a ${incident.type}` });
		}

		await addIncidentUpdate(db, id, status, message);

		if (incident.type === 'maintenance') {
			if (status === 'in_progress' && incident.status !== 'in_progress') {
				await transitionServices(
					db,
					incident.services.map((s) => ({ serviceId: s.serviceId, to: 'maintenance' })),
					`Scheduled maintenance: ${incident.title}`,
					['operational']
				);
			} else if (status === 'completed' && incident.status !== 'completed') {
				await transitionServices(
					db,
					incident.services.map((s) => ({ serviceId: s.serviceId, to: 'operational' })),
					`Maintenance completed: ${incident.title}`,
					['maintenance']
				);
			}
		} else if (status === 'resolved' && restore) {
			await transitionServices(
				db,
				incident.services.map((s) => ({ serviceId: s.serviceId, to: 'operational' })),
				`Incident resolved: ${incident.title}`
			);
		}
		await broadcastUpdate(locals.env, 'incidents');
	},

	editIncident: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = Number(form.get('id'));
		const title = String(form.get('title') ?? '').trim();
		const severity = form.get('severity');
		if (!Number.isInteger(id) || !title || !isIncidentSeverity(severity)) {
			return fail(400, { message: 'Invalid incident edit' });
		}
		const incident = await getIncident(locals.env.DB, id);
		if (!incident) return fail(404, { message: 'Incident not found' });
		// maintenance events keep their fixed severity
		await editIncident(
			locals.env.DB,
			id,
			title,
			incident.type === 'maintenance' ? 'maintenance' : severity
		);
		await broadcastUpdate(locals.env, 'incidents');
	},

	deleteIncident: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isInteger(id)) return fail(400, { message: 'Invalid incident' });
		await deleteIncident(locals.env.DB, id);
		await broadcastUpdate(locals.env, 'incidents');
	},

	deleteUpdate: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const updateId = Number(form.get('updateId'));
		if (!Number.isInteger(updateId)) return fail(400, { message: 'Invalid update' });
		await deleteIncidentUpdate(locals.env.DB, updateId);
		await broadcastUpdate(locals.env, 'incidents');
	},

	savePostmortem: async ({ locals, request }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = Number(form.get('id'));
		const postmortem = String(form.get('postmortem') ?? '').trim();
		if (!Number.isInteger(id)) return fail(400, { message: 'Invalid incident' });
		await savePostmortem(locals.env.DB, id, postmortem || null);
		await broadcastUpdate(locals.env, 'incidents');
		return { message: 'Postmortem saved' };
	},

	saveSiteSettings: async ({ locals, request }) => {
		requireUser(locals);
		const db = locals.env.DB;
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const icon = String(form.get('icon') ?? '');
		if (!title) return fail(400, { message: 'Site title is required' });
		if (icon && !isIconName(icon)) return fail(400, { message: 'Unknown icon' });

		const current = await getSiteSettings(db);
		await setSetting(db, 'siteTitle', title);
		await setSetting(db, 'siteDescription', description);
		await setSetting(db, 'siteIcon', icon || null);

		const file = form.get('image');
		if (file instanceof File && file.size > 0) {
			const result = await saveImage(db, file);
			if (typeof result === 'string') return fail(400, { message: result });
			await deleteImage(db, current.imageId);
			await setSetting(db, 'siteImageId', String(result));
		} else if (form.get('removeImage') === 'on') {
			await deleteImage(db, current.imageId);
			await setSetting(db, 'siteImageId', null);
		}
		await broadcastUpdate(locals.env, 'site');
		return { message: 'Site settings saved' };
	},

	setServiceVisual: async ({ locals, request }) => {
		requireUser(locals);
		const db = locals.env.DB;
		const form = await request.formData();
		const id = Number(form.get('id'));
		const icon = String(form.get('icon') ?? '');
		if (!Number.isInteger(id)) return fail(400, { message: 'Invalid service' });
		if (icon && !isIconName(icon)) return fail(400, { message: 'Unknown icon' });

		const currentImageId = await getServiceImageId(db, id);
		let imageId = currentImageId;
		const file = form.get('image');
		if (file instanceof File && file.size > 0) {
			const result = await saveImage(db, file);
			if (typeof result === 'string') return fail(400, { message: result });
			await deleteImage(db, currentImageId);
			imageId = result;
		} else if (form.get('removeImage') === 'on') {
			await deleteImage(db, currentImageId);
			imageId = null;
		}
		await setServiceVisual(db, id, icon || null, imageId);
		await broadcastUpdate(locals.env, 'services');
	}
};
