<script lang="ts">
	import SignupForm from '$lib/components/SignupForm.svelte';
</script>

<svelte:head>
	<title>Welcome — set up your status page</title>
</svelte:head>

<div class="card">
	<h1>Welcome 👋</h1>
	<p class="intro">
		This status page has no accounts yet. Create the first one — it becomes the admin account
		that manages services, uptime monitors, and incidents.
	</p>
	<SignupForm submitLabel="Create admin account" />
	<p class="note">
		After this, sign-up is <strong>invitation-only</strong> by default. You can invite teammates
		or open sign-ups from the dashboard.
	</p>
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
		margin-bottom: 1.3rem;
	}
	.note {
		color: #64748b;
		font-size: 0.8rem;
		margin: 1.2rem 0 0;
	}
</style>
