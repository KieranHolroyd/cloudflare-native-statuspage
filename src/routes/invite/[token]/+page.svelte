<script lang="ts">
	import SignupForm from '$lib/components/SignupForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>You're invited</title>
</svelte:head>

<div class="card">
	{#if data.valid}
		<h1>You're invited 🎉</h1>
		<p class="intro">
			You've been invited to help manage this status page.
			{#if data.note}<br /><em>“{data.note}”</em>{/if}
		</p>
		<SignupForm submitLabel="Accept invitation" />
	{:else}
		<h1>Invitation not valid</h1>
		<p class="intro">
			This invitation link has expired, was revoked, or has already been used. Ask whoever
			invited you for a new link.
		</p>
		<a href="/">Back to the status page</a>
	{/if}
</div>

<style>
	.card {
		max-width: 420px;
		margin: 3rem auto 0;
		background: #101828;
		border: 1px solid #1e293b;
		border-radius: 12px;
		padding: 1.75rem;
	}
	h1 {
		margin-top: 0;
		font-size: 1.4rem;
	}
	.intro {
		color: #94a3b8;
		font-size: 0.9rem;
	}
</style>
