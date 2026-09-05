import type { IncidentSeverity, IncidentStatus, IncidentType, Status } from '$lib/status';

export interface Service {
	id: number;
	name: string;
	description: string | null;
	status: Status;
	monitorUrl: string | null;
	icon: string | null;
	imageId: number | null;
	sortOrder: number;
	updatedAt: string;
}

export interface SiteSettings {
	title: string;
	description: string;
	icon: string | null;
	imageId: number | null;
}

export interface StatusEvent {
	id: number;
	serviceId: number;
	serviceName: string;
	status: Status;
	note: string | null;
	createdAt: string;
}

export interface IncidentService {
	serviceId: number;
	serviceName: string;
	impact: Status;
}

export interface Incident {
	id: number;
	type: IncidentType;
	title: string;
	severity: IncidentSeverity;
	status: IncidentStatus;
	createdAt: string;
	resolvedAt: string | null;
	scheduledStart: string | null;
	scheduledEnd: string | null;
	postmortem: string | null;
	services: IncidentService[];
	updates: IncidentUpdate[];
}

export interface IncidentUpdate {
	id: number;
	incidentId: number;
	status: IncidentStatus;
	message: string;
	createdAt: string;
}

/** One point on a latency chart: a 15-minute bucket. */
export interface LatencyPoint {
	t: number; // unix seconds, bucket start
	avgMs: number;
	maxMs: number;
	okRate: number; // 0..1
}

export interface DayUptime {
	day: string; // YYYY-MM-DD
	pct: number | null; // null = no data
}

/** Full public status page payload (SSR initial data + /api/overview). */
export interface Overview {
	services: Service[];
	events: StatusEvent[];
	incidents: { active: Incident[]; upcoming: Incident[]; resolved: Incident[] };
	metrics: Record<string, ServiceMetrics>;
}

export interface ServiceMetrics {
	uptime24h: number | null;
	/** All-time uptime %, from daily aggregates (kept forever). */
	uptimeAll: number | null;
	latency: LatencyPoint[];
	days: DayUptime[];
}
