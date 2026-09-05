<script lang="ts">
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import Visual from '$lib/components/Visual.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				// SSR provides initialData; only the browser refetches
				enabled: browser,
				staleTime: 5_000
			}
		}
	});

	async function signOut() {
		await authClient.signOut();
		await invalidateAll();
		await goto('/');
	}
</script>

<svelte:head>
	{#if data.site.imageId !== null}
		<link rel="icon" href="/img/{data.site.imageId}" />
	{/if}
	{#if data.site.description}
		<meta name="description" content={data.site.description} />
	{/if}
	<link rel="alternate" type="application/rss+xml" title="{data.site.title} incidents" href="/feed.xml" />
</svelte:head>

<QueryClientProvider client={queryClient}>
<div class="shell">
	<header>
		<a class="brand" href="/">
			{#if data.site.imageId !== null || data.site.icon}
				<Visual imageId={data.site.imageId} icon={data.site.icon} alt="" size={22} />
			{:else}
				▲
			{/if}
			{data.site.title}
		</a>
		<nav>
			{#if data.user}
				<a href="/dashboard">Dashboard</a>
				<button class="link" onclick={signOut}>Sign out ({data.user.email})</button>
			{:else}
				<a href="/login">Sign in</a>
			{/if}
		</nav>
	</header>
	<main>
		{@render children()}
	</main>
	<footer>
		<a href="/history">History</a> &middot; <a href="/feed.xml">RSS</a> &middot;
		<a href="/api/status">JSON&nbsp;API</a>
		<br />
		Running on a Cloudflare Worker &middot; D1 &middot; better-auth &middot; SvelteKit
	</footer>
</div>
</QueryClientProvider>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		font-family:
			ui-sans-serif,
			system-ui,
			-apple-system,
			sans-serif;
		background: #0b0f1a;
		color: #e5e9f0;
	}
	:global(h1, h2, h3) {
		font-weight: 650;
		letter-spacing: -0.01em;
	}
	:global(a) {
		color: #93c5fd;
		text-decoration: none;
	}
	:global(a:hover) {
		text-decoration: underline;
	}
	:global(input, textarea, select) {
		background: #101828;
		border: 1px solid #2a3550;
		border-radius: 8px;
		color: inherit;
		padding: 0.55rem 0.7rem;
		font: inherit;
		width: 100%;
	}
	:global(button) {
		background: #2563eb;
		border: none;
		border-radius: 8px;
		color: white;
		padding: 0.55rem 1rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	:global(button:hover) {
		background: #1d4ed8;
	}
	:global(button.danger) {
		background: #7f1d1d;
	}
	:global(button.danger:hover) {
		background: #991b1b;
	}

	.shell {
		max-width: 860px;
		margin: 0 auto;
		padding: 1.25rem;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding-bottom: 1.5rem;
	}
	.brand {
		font-weight: 700;
		color: #e5e9f0;
		font-size: 1.05rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	button.link {
		background: none;
		color: #93c5fd;
		font-weight: 400;
		padding: 0;
	}
	button.link:hover {
		background: none;
		text-decoration: underline;
	}
	main {
		flex: 1;
	}
	footer {
		padding-top: 2.5rem;
		font-size: 0.8rem;
		color: #64748b;
		text-align: center;
	}
</style>
