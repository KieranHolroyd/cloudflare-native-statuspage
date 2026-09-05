<script lang="ts">
	import { fmtDateTime, fmtDuration, fmtMonth } from '$lib/format';
	import { CLOSED_STATUSES, INCIDENT_SEVERITIES, INCIDENT_STATUSES } from '$lib/status';
	import type { Incident } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const byMonth = $derived.by(() => {
		const groups: { month: string; incidents: Incident[] }[] = [];
		for (const incident of data.history.incidents) {
			const month = incident.createdAt.slice(0, 7);
			const last = groups.at(-1);
			if (last && last.month === month) last.incidents.push(incident);
			else groups.push({ month, incidents: [incident] });
		}
		return groups;
	});
</script>

<svelte:head>
	<title>Incident history</title>
</svelte:head>

<p class="back"><a href="/">&larr; Back to status page</a></p>
<h1>Incident history</h1>

{#if byMonth.length === 0}
	<p class="empty">No incidents recorded — a spotless record.</p>
{/if}

{#snippet pager()}
	{#if data.history.pages > 1}
		<nav class="pager">
			{#if data.history.page > 1}
				<a href="?page={data.history.page - 1}">&larr; Newer</a>
			{:else}<span></span>{/if}
			<span class="page-num">Page {data.history.page} of {data.history.pages}</span>
			{#if data.history.page < data.history.pages}
				<a href="?page={data.history.page + 1}">Older &rarr;</a>
			{:else}<span></span>{/if}
		</nav>
	{/if}
{/snippet}

{@render pager()}

{#each byMonth as group (group.month)}
	<section>
		<h2>{fmtMonth(group.month + '-01T00:00:00Z')}</h2>
		<ul>
			{#each group.incidents as incident (incident.id)}
				<li>
					<div class="line">
						<span class="chip" style:--c={INCIDENT_SEVERITIES[incident.severity].color}>
							{INCIDENT_SEVERITIES[incident.severity].label}
						</span>
						<a href="/incident/{incident.id}" class="title">{incident.title}</a>
						<span class="chip" style:--c={INCIDENT_STATUSES[incident.status].color}>
							{INCIDENT_STATUSES[incident.status].label}
						</span>
					</div>
					<p class="sub">
						{fmtDateTime(incident.createdAt)}
						{#if CLOSED_STATUSES.includes(incident.status) && incident.resolvedAt}
							&middot; lasted {fmtDuration(incident.createdAt, incident.resolvedAt)}
						{/if}
						{#if incident.services.length > 0}
							&middot; {incident.services.map((s) => s.serviceName).join(', ')}
						{/if}
					</p>
				</li>
			{/each}
		</ul>
	</section>
{/each}

{@render pager()}

<style>
	.pager {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 1.2rem 0;
		font-size: 0.85rem;
	}
	.page-num {
		color: #64748b;
	}
	.back {
		font-size: 0.85rem;
	}
	h1 {
		font-size: 1.4rem;
	}
	h2 {
		font-size: 0.95rem;
		color: #94a3b8;
		border-bottom: 1px solid #1e293b;
		padding-bottom: 0.4rem;
		margin: 1.8rem 0 0.8rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.title {
		font-weight: 600;
		color: #e5e9f0;
	}
	.chip {
		color: var(--c);
		border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
		background: color-mix(in srgb, var(--c) 12%, transparent);
		border-radius: 999px;
		padding: 0.12rem 0.5rem;
		font-size: 0.72rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.sub {
		margin: 0.25rem 0 0;
		font-size: 0.8rem;
		color: #64748b;
	}
	.empty {
		color: #94a3b8;
	}
</style>
