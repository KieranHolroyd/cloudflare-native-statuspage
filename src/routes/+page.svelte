<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import LatencyChart from '$lib/components/LatencyChart.svelte';
	import UptimeBars from '$lib/components/UptimeBars.svelte';
	import Visual from '$lib/components/Visual.svelte';
	import { subscribeToUpdates } from '$lib/realtime-client';
	import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, STATUSES } from '$lib/status';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let live = $state(false);

	$effect(() => {
		return subscribeToUpdates(() => {
			live = true;
			invalidateAll();
		});
	});

	const allOperational = $derived(
		data.services.every((s) => s.status === 'operational') && data.incidents.active.length === 0
	);

	function fmt(iso: string) {
		return new Date(iso).toLocaleString();
	}
</script>

<svelte:head>
	<title>{data.site.title} — status</title>
</svelte:head>

{#if data.site.description}
	<p class="site-desc">{data.site.description}</p>
{/if}

<section class="banner" class:ok={allOperational} class:bad={!allOperational}>
	<h1>
		{allOperational ? 'All systems operational' : 'Some systems are experiencing issues'}
	</h1>
	<span class="live" class:on={live} title={live ? 'Live updates connected' : 'Polling for updates'}>
		● {live ? 'live' : 'polling'}
	</span>
</section>

{#if data.incidents.active.length > 0}
	<section class="incidents">
		{#each data.incidents.active as incident (incident.id)}
			<article class="incident" class:maint={incident.type === 'maintenance'}>
				<header>
					<h2><a href="/incident/{incident.id}">{incident.title}</a></h2>
					<span class="chip" style:--c={INCIDENT_SEVERITIES[incident.severity].color}>
						{INCIDENT_SEVERITIES[incident.severity].label}
					</span>
				</header>
				{#if incident.services.length > 0}
					<p class="affects">
						Affects: {incident.services.map((s) => s.serviceName).join(', ')}
					</p>
				{/if}
				<ol class="timeline">
					{#each incident.updates as update (update.id)}
						<li>
							<span class="chip small" style:--c={INCIDENT_STATUSES[update.status].color}>
								{INCIDENT_STATUSES[update.status].label}
							</span>
							<p>{update.message}</p>
							<time>{fmt(update.createdAt)}</time>
						</li>
					{/each}
				</ol>
			</article>
		{/each}
	</section>
{/if}

{#if data.incidents.upcoming.length > 0}
	<section class="incidents">
		<h2 class="section-title">Scheduled maintenance</h2>
		{#each data.incidents.upcoming as incident (incident.id)}
			<article class="incident maint">
				<header>
					<h2><a href="/incident/{incident.id}">{incident.title}</a></h2>
					<span class="chip" style:--c={INCIDENT_STATUSES[incident.status].color}>
						{INCIDENT_STATUSES[incident.status].label}
					</span>
				</header>
				{#if incident.scheduledStart && incident.scheduledEnd}
					<p class="affects">
						{fmt(incident.scheduledStart)} &rarr; {fmt(incident.scheduledEnd)}
						{#if incident.services.length > 0}
							&middot; affects {incident.services.map((s) => s.serviceName).join(', ')}
						{/if}
					</p>
				{/if}
			</article>
		{/each}
	</section>
{/if}

<section class="services">
	{#each data.services as service (service.id)}
		{@const m = data.metrics[service.id]}
		<div class="service">
			<div class="service-head">
				<div class="service-id">
					{#if service.imageId !== null || service.icon}
						<span class="service-visual">
							<Visual imageId={service.imageId} icon={service.icon} alt="" size={20} />
						</span>
					{/if}
					<div>
						<strong>{service.name}</strong>
						{#if service.description}<p>{service.description}</p>{/if}
					</div>
				</div>
				<span class="pill" style:--c={STATUSES[service.status].color}>
					{STATUSES[service.status].label}
				</span>
			</div>
			{#if service.monitorUrl}
				<LatencyChart points={m?.latency ?? []} />
				<UptimeBars
					days={m?.days ?? []}
					uptime24h={m?.uptime24h ?? null}
					uptimeAll={m?.uptimeAll ?? null}
				/>
			{/if}
		</div>
	{:else}
		<p>No services configured yet.</p>
	{/each}
</section>

{#if data.incidents.resolved.length > 0}
	<section>
		<h2 class="section-title">Past incidents</h2>
		<ul class="past">
			{#each data.incidents.resolved as incident (incident.id)}
				<li>
					<span class="chip small" style:--c={INCIDENT_SEVERITIES[incident.severity].color}>
						{INCIDENT_SEVERITIES[incident.severity].label}
					</span>
					<strong><a href="/incident/{incident.id}">{incident.title}</a></strong>
					<time>{fmt(incident.createdAt)}{incident.resolvedAt ? ` — closed ${fmt(incident.resolvedAt)}` : ''}</time>
				</li>
			{/each}
		</ul>
		<p class="history-link"><a href="/history">View full incident history &rarr;</a></p>
	</section>
{/if}

{#if data.events.length > 0}
	<section>
		<h2 class="section-title">Recent updates</h2>
		<ul class="events">
			{#each data.events as event (event.id)}
				<li>
					<span class="dot" style:--c={STATUSES[event.status].color}></span>
					<div>
						<strong>{event.serviceName}</strong> &rarr; {STATUSES[event.status].label}
						{#if event.note}<p>{event.note}</p>{/if}
						<time>{fmt(event.createdAt)}</time>
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.banner {
		border-radius: 12px;
		padding: 1.4rem 1.5rem;
		margin-bottom: 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.banner h1 {
		margin: 0;
		font-size: 1.35rem;
	}
	.banner.ok {
		background: #052e16;
		border: 1px solid #166534;
	}
	.banner.bad {
		background: #431407;
		border: 1px solid #9a3412;
	}
	.live {
		font-size: 0.75rem;
		color: #64748b;
		white-space: nowrap;
	}
	.live.on {
		color: #22c55e;
	}

	.incidents {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		margin-bottom: 1.5rem;
	}
	.incident {
		background: #1c1207;
		border: 1px solid #7c2d12;
		border-radius: 10px;
		padding: 1rem 1.2rem;
	}
	.incident.maint {
		background: #0c1524;
		border-color: #1e3a8a;
	}
	.incident h2 a {
		color: inherit;
	}
	.history-link {
		font-size: 0.85rem;
		margin-top: 0.8rem;
	}
	.incident header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.incident h2 {
		margin: 0;
		font-size: 1.05rem;
	}
	.affects {
		color: #94a3b8;
		font-size: 0.82rem;
		margin: 0.3rem 0 0;
	}
	.timeline {
		list-style: none;
		margin: 0.8rem 0 0;
		padding: 0 0 0 0.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.timeline p {
		margin: 0.15rem 0;
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
		font-size: 0.7rem;
		padding: 0.1rem 0.5rem;
	}

	.services {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.service {
		background: #101828;
		border: 1px solid #1e293b;
		border-radius: 10px;
		padding: 0.9rem 1.1rem;
	}
	.site-desc {
		color: #94a3b8;
		margin: -0.5rem 0 1rem;
	}
	.service-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.service-id {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.service-visual {
		display: flex;
		color: #94a3b8;
		flex-shrink: 0;
	}
	.service-head p {
		margin: 0.2rem 0 0;
		color: #94a3b8;
		font-size: 0.85rem;
	}
	.pill {
		color: var(--c);
		border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
		background: color-mix(in srgb, var(--c) 12%, transparent);
		border-radius: 999px;
		padding: 0.25rem 0.75rem;
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.section-title {
		font-size: 1.05rem;
		margin: 1.8rem 0 0.8rem;
	}
	.past {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.past li {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.events {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.events li {
		display: flex;
		gap: 0.7rem;
		align-items: baseline;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--c);
		flex-shrink: 0;
	}
	.events p {
		margin: 0.15rem 0;
		color: #94a3b8;
	}
	time {
		font-size: 0.78rem;
		color: #64748b;
	}
</style>
