export const STATUSES = {
	operational: { label: 'Operational', color: '#22c55e' },
	degraded: { label: 'Degraded performance', color: '#eab308' },
	partial_outage: { label: 'Partial outage', color: '#f97316' },
	major_outage: { label: 'Major outage', color: '#ef4444' },
	maintenance: { label: 'Under maintenance', color: '#3b82f6' }
} as const;

export type Status = keyof typeof STATUSES;

export function isStatus(value: unknown): value is Status {
	return typeof value === 'string' && value in STATUSES;
}

export const INCIDENT_SEVERITIES = {
	minor: { label: 'Minor', color: '#eab308' },
	major: { label: 'Major', color: '#f97316' },
	critical: { label: 'Critical', color: '#ef4444' },
	maintenance: { label: 'Maintenance', color: '#3b82f6' }
} as const;

export type IncidentSeverity = keyof typeof INCIDENT_SEVERITIES;

export function isIncidentSeverity(value: unknown): value is IncidentSeverity {
	return typeof value === 'string' && value in INCIDENT_SEVERITIES;
}

export const INCIDENT_STATUSES = {
	investigating: { label: 'Investigating', color: '#ef4444' },
	identified: { label: 'Identified', color: '#f97316' },
	monitoring: { label: 'Monitoring', color: '#3b82f6' },
	resolved: { label: 'Resolved', color: '#22c55e' },
	scheduled: { label: 'Scheduled', color: '#3b82f6' },
	in_progress: { label: 'In progress', color: '#a855f7' },
	completed: { label: 'Completed', color: '#22c55e' }
} as const;

export type IncidentStatus = keyof typeof INCIDENT_STATUSES;

export function isIncidentStatus(value: unknown): value is IncidentStatus {
	return typeof value === 'string' && value in INCIDENT_STATUSES;
}

export type IncidentType = 'incident' | 'maintenance';

/** Which statuses each incident type moves through. */
export const STATUS_FLOWS: Record<IncidentType, readonly IncidentStatus[]> = {
	incident: ['investigating', 'identified', 'monitoring', 'resolved'],
	maintenance: ['scheduled', 'in_progress', 'completed']
};

export const CLOSED_STATUSES: readonly IncidentStatus[] = ['resolved', 'completed'];

/** Service impact levels selectable when opening an incident. */
export const IMPACT_LEVELS = ['degraded', 'partial_outage', 'major_outage'] as const;

export function isImpactLevel(value: unknown): value is (typeof IMPACT_LEVELS)[number] {
	return typeof value === 'string' && (IMPACT_LEVELS as readonly string[]).includes(value);
}
