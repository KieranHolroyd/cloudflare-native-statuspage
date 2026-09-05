<script lang="ts">
	import type { DayUptime } from '$lib/types';

	let {
		days,
		uptime24h,
		uptimeAll = null
	}: { days: DayUptime[]; uptime24h: number | null; uptimeAll?: number | null } = $props();

	function color(pct: number | null): string {
		if (pct === null) return '#1e293b';
		if (pct >= 99.5) return '#22c55e';
		if (pct >= 95) return '#eab308';
		return '#ef4444';
	}
	function tooltip(d: DayUptime): string {
		return d.pct === null ? `${d.day}: no data` : `${d.day}: ${d.pct.toFixed(2)}% uptime`;
	}

	const overall = $derived.by(() => {
		const measured = days.filter((d) => d.pct !== null);
		if (measured.length === 0) return null;
		return measured.reduce((sum, d) => sum + (d.pct ?? 0), 0) / measured.length;
	});
</script>

<div class="uptime">
	<div class="bars" role="img" aria-label="Daily uptime, last 90 days">
		{#each days as d (d.day)}
			<span class="bar" style:background={color(d.pct)}><i>{tooltip(d)}</i></span>
		{/each}
	</div>
	<div class="legend">
		<span>90 days ago</span>
		<span>
			{#if overall !== null}{overall.toFixed(2)}% (90d){/if}
			{#if uptime24h !== null}&nbsp;&middot; {uptime24h.toFixed(2)}% (24h){/if}
			{#if uptimeAll !== null}&nbsp;&middot; {uptimeAll.toFixed(3)}% (all&#8209;time){/if}
		</span>
		<span>Today</span>
	</div>
</div>

<style>
	.uptime {
		margin-top: 0.6rem;
	}
	.bars {
		display: flex;
		gap: 2px;
		height: 26px;
	}
	.bar {
		flex: 1;
		border-radius: 2px;
		position: relative;
	}
	.bar i {
		display: none;
		position: absolute;
		bottom: 130%;
		left: 50%;
		transform: translateX(-50%);
		background: #1e293b;
		color: #e5e9f0;
		font-style: normal;
		font-size: 0.7rem;
		padding: 0.2rem 0.45rem;
		border-radius: 5px;
		white-space: nowrap;
		z-index: 2;
	}
	.bar:hover i {
		display: block;
	}
	.legend {
		display: flex;
		justify-content: space-between;
		font-size: 0.7rem;
		color: #64748b;
		margin-top: 0.3rem;
	}
</style>
