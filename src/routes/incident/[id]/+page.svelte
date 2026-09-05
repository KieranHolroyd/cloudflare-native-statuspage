<script lang="ts">
	import { fmtDateTime, fmtDuration } from '$lib/format';
	import { CLOSED_STATUSES, INCIDENT_SEVERITIES, INCIDENT_STATUSES, STATUSES } from '$lib/status';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const incident = $derived(data.incident);
	const closed = $derived(CLOSED_STATUSES.includes(incident.status));
</script>

<svelte:head>
	<title>{incident.title} — incident details</title>
</svelte:head>

<p class="back"><a href="/">&larr; Back to status page</a></p>

<article class="detail">
	<header>
		<h1>{incident.title}</h1>
		<div class="chips">
			<span class="chip" style:--c={INCIDENT_SEVERITIES[incident.severity].color}>
				{INCIDENT_SEVERITIES[incident.severity].label}
			</span>
			<span class="chip" style:--c={INCIDENT_STATUSES[incident.status].color}>
				{INCIDENT_STATUSES[incident.status].label}
			</span>
		</div>
	</header>

	<dl class="meta">
		{#if incident.type === 'maintenance' && incident.scheduledStart && incident.scheduledEnd}
			<dt>Maintenance window</dt>
			<dd>
				{fmtDateTime(incident.scheduledStart)} &rarr; {fmtDateTime(incident.scheduledEnd)}
				({fmtDuration(incident.scheduledStart, incident.scheduledEnd)})
			</dd>
		{:else}
			<dt>Opened</dt>
			<dd>{fmtDateTime(incident.createdAt)}</dd>
		{/if}
		{#if closed && incident.resolvedAt}
			<dt>{incident.type === 'maintenance' ? 'Completed' : 'Resolved'}</dt>
			<dd>
				{fmtDateTime(incident.resolvedAt)} — after {fmtDuration(
					incident.createdAt,
					incident.resolvedAt
				)}
			</dd>
		{/if}
		{#if incident.services.length > 0}
			<dt>Affected services</dt>
			<dd class="chips">
				{#each incident.services as s (s.serviceId)}
					<span class="chip small" style:--c={STATUSES[s.impact].color}>
						{s.serviceName}: {STATUSES[s.impact].label}
					</span>
				{/each}
			</dd>
		{/if}
	</dl>

	{#if incident.postmortem}
		<section class="postmortem">
			<h2>Postmortem</h2>
			<p>{incident.postmortem}</p>
		</section>
	{/if}

	<section>
		<h2>Timeline</h2>
		<ol class="timeline">
			{#each incident.updates as update (update.id)}
				<li>
					<span class="chip small" style:--c={INCIDENT_STATUSES[update.status].color}>
						{INCIDENT_STATUSES[update.status].label}
					</span>
					<div>
						<p>{update.message}</p>
						<time>{fmtDateTime(update.createdAt)}</time>
					</div>
				</li>
			{/each}
		</ol>
	</section>
</article>

<style>
	.back {
		font-size: 0.85rem;
	}
	.detail {
		background: #101828;
		border: 1px solid #1e293b;
		border-radius: 12px;
		padding: 1.5rem 1.75rem;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0;
		font-size: 1.4rem;
	}
	h2 {
		font-size: 1rem;
		margin: 1.6rem 0 0.7rem;
	}
	.chips {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.chip {
		color: var(--c);
		border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
		background: color-mix(in srgb, var(--c) 12%, transparent);
		border-radius: 999px;
		padding: 0.2rem 0.65rem;
		font-size: 0.78rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.chip.small {
		font-size: 0.72rem;
		padding: 0.12rem 0.5rem;
	}
	.meta {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.5rem 1.2rem;
		margin: 1.2rem 0 0;
		font-size: 0.9rem;
	}
	dt {
		color: #64748b;
	}
	dd {
		margin: 0;
	}
	.postmortem {
		background: #0d1424;
		border: 1px solid #1e293b;
		border-radius: 8px;
		padding: 0.2rem 1.1rem 0.9rem;
		margin-top: 1.4rem;
	}
	.postmortem h2 {
		margin-top: 0.9rem;
	}
	.postmortem p {
		margin: 0;
		color: #cbd5e1;
		white-space: pre-wrap;
	}
	.timeline {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.timeline li {
		display: flex;
		gap: 0.7rem;
		align-items: baseline;
	}
	.timeline p {
		margin: 0;
	}
	time {
		font-size: 0.78rem;
		color: #64748b;
	}
</style>
