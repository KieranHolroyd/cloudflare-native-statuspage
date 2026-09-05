<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import SignupForm from '$lib/components/SignupForm.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mode: 'signin' | 'signup' = $state('signin');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		busy = true;
		const result = await authClient.signIn.email({ email, password });
		busy = false;
		if (result.error) {
			error = result.error.message ?? 'Something went wrong';
			return;
		}
		await invalidateAll();
		await goto('/dashboard');
	}
</script>

<svelte:head>
	<title>{mode === 'signup' ? 'Create account' : 'Sign in'}</title>
</svelte:head>

<div class="card">
	<h1>{mode === 'signup' ? 'Create an account' : 'Sign in'}</h1>

	{#if mode === 'signup'}
		<SignupForm />
	{:else}
		<form onsubmit={submit}>
			<label>
				Email
				<input type="email" bind:value={email} required autocomplete="email" />
			</label>
			<label>
				Password
				<input type="password" bind:value={password} required autocomplete="current-password" />
			</label>

			{#if error}<p class="error">{error}</p>{/if}

			<button type="submit" disabled={busy}>{busy ? 'Working…' : 'Sign in'}</button>
		</form>
	{/if}

	{#if data.signupsOpen}
		<p class="switch">
			{#if mode === 'signin'}
				No account?
				<button class="link" onclick={() => (mode = 'signup')}>Create one</button>
			{:else}
				Already registered?
				<button class="link" onclick={() => (mode = 'signin')}>Sign in</button>
			{/if}
		</p>
	{:else}
		<p class="switch">Sign-up is invitation-only. Ask an admin for an invite link.</p>
	{/if}
</div>

<style>
	.card {
		max-width: 380px;
		margin: 3rem auto 0;
		background: #101828;
		border: 1px solid #1e293b;
		border-radius: 12px;
		padding: 1.75rem;
	}
	h1 {
		margin-top: 0;
		font-size: 1.3rem;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: #94a3b8;
	}
	.error {
		color: #fca5a5;
		margin: 0;
		font-size: 0.85rem;
	}
	.switch {
		margin-bottom: 0;
		font-size: 0.85rem;
		color: #94a3b8;
	}
	button.link {
		background: none;
		color: #93c5fd;
		padding: 0;
		font-weight: 400;
	}
	button.link:hover {
		background: none;
		text-decoration: underline;
	}
</style>
