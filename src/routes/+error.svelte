<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — something went wrong</title>
</svelte:head>

<div class="card">
	<h1>{page.status}</h1>
	<p>
		{#if page.status === 404}
			This page doesn't exist.
		{:else}
			{page.error?.message ?? 'Something went wrong.'}
		{/if}
	</p>
	<a href="/">&larr; Back to the status page</a>
</div>

<style>
	.card {
		max-width: 420px;
		margin: 4rem auto 0;
		background: #101828;
		border: 1px solid #1e293b;
		border-radius: 12px;
		padding: 1.75rem;
		text-align: center;
	}
	h1 {
		margin: 0 0 0.5rem;
		font-size: 2.4rem;
		color: #64748b;
	}
	p {
		color: #94a3b8;
	}
</style>
