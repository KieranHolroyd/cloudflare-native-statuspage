<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

	let { submitLabel = 'Create account' }: { submitLabel?: string } = $props();

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		busy = true;
		const result = await authClient.signUp.email({ name, email, password });
		busy = false;
		if (result.error) {
			error = result.error.message ?? 'Something went wrong';
			return;
		}
		await invalidateAll();
		await goto('/dashboard');
	}
</script>

<form onsubmit={submit}>
	<label>
		Name
		<input type="text" bind:value={name} required autocomplete="name" />
	</label>
	<label>
		Email
		<input type="email" bind:value={email} required autocomplete="email" />
	</label>
	<label>
		Password
		<input type="password" bind:value={password} required minlength="8" autocomplete="new-password" />
	</label>

	{#if error}<p class="error">{error}</p>{/if}

	<button type="submit" disabled={busy}>{busy ? 'Working…' : submitLabel}</button>
</form>

<style>
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
</style>
