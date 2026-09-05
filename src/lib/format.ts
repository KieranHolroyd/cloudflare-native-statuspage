export function fmtDateTime(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});
}

export function fmtDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function fmtMonth(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Human duration between two ISO timestamps, e.g. "2h 15m". */
export function fmtDuration(startIso: string, endIso: string): string {
	const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
	if (ms < 0) return '—';
	const minutes = Math.round(ms / 60_000);
	if (minutes < 1) return 'under a minute';
	const days = Math.floor(minutes / 1440);
	const hours = Math.floor((minutes % 1440) / 60);
	const mins = minutes % 60;
	const parts: string[] = [];
	if (days) parts.push(`${days}d`);
	if (hours) parts.push(`${hours}h`);
	if (mins && !days) parts.push(`${mins}m`);
	return parts.join(' ') || `${mins}m`;
}
