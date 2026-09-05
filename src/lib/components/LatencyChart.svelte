<script lang="ts">
	import type { LatencyPoint } from '$lib/types';

	let { points }: { points: LatencyPoint[] } = $props();

	const W = 600;
	const H = 80;
	const PAD = 4;

	const maxMs = $derived(Math.max(...points.map((p) => p.maxMs), 50));
	const tMin = $derived(points.length ? points[0].t : 0);
	const tMax = $derived(points.length ? points[points.length - 1].t : 1);

	function x(t: number): number {
		if (tMax === tMin) return W / 2;
		return PAD + ((t - tMin) / (tMax - tMin)) * (W - PAD * 2);
	}
	function y(ms: number): number {
		return H - PAD - (ms / maxMs) * (H - PAD * 2);
	}

	const avgPath = $derived(
		points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.avgMs).toFixed(1)}`).join(' ')
	);
	const areaPath = $derived(
		points.length
			? `${avgPath} L${x(points[points.length - 1].t).toFixed(1)},${H - PAD} L${x(points[0].t).toFixed(1)},${H - PAD} Z`
			: ''
	);
	const failures = $derived(points.filter((p) => p.okRate < 1));
	const latest = $derived(points.length ? points[points.length - 1].avgMs : null);
</script>

{#if points.length === 0}
	<p class="empty">No latency data yet — set a monitor URL and checks will appear here.</p>
{:else}
	<div class="chart">
		<div class="meta">
			<span>Latency, last 24h</span>
			<span class="now">{latest} ms &middot; peak {maxMs} ms</span>
		</div>
		<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="Latency chart">
			<path d={areaPath} fill="rgba(59, 130, 246, 0.15)" />
			<path d={avgPath} fill="none" stroke="#3b82f6" stroke-width="1.5" vector-effect="non-scaling-stroke" />
			{#each failures as p (p.t)}
				<circle cx={x(p.t)} cy={y(p.avgMs)} r="3" fill="#ef4444">
					<title>{Math.round((1 - p.okRate) * 100)}% of checks failed</title>
				</circle>
			{/each}
		</svg>
	</div>
{/if}

<style>
	.chart {
		margin-top: 0.6rem;
	}
	.meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.72rem;
		color: #64748b;
		margin-bottom: 0.25rem;
	}
	.now {
		color: #93c5fd;
	}
	svg {
		width: 100%;
		height: 60px;
		display: block;
		background: #0d1424;
		border: 1px solid #1e293b;
		border-radius: 6px;
	}
	.empty {
		font-size: 0.78rem;
		color: #64748b;
		margin: 0.5rem 0 0;
	}
</style>
