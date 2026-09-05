<script lang="ts">
	import type { CellContext, ColumnDef } from '@tanstack/table-core';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import IconPicker from '$lib/components/IconPicker.svelte';
	import Visual from '$lib/components/Visual.svelte';
	import { fmtDate as fmtDateShort, fmtDateTime } from '$lib/format';
	import { createSvelteTable } from '$lib/table.svelte';
	import {
		IMPACT_LEVELS,
		INCIDENT_SEVERITIES,
		INCIDENT_STATUSES,
		STATUSES,
		STATUS_FLOWS
	} from '$lib/status';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const open = $derived([...data.incidents.active, ...data.incidents.upcoming]);
	const incidentSeverities = Object.entries(INCIDENT_SEVERITIES).filter(
		([key]) => key !== 'maintenance'
	);

	let maintStart = $state('');
	let maintEnd = $state('');
	const maintStartIso = $derived(maintStart ? new Date(maintStart).toISOString() : '');
	const maintEndIso = $derived(maintEnd ? new Date(maintEnd).toISOString() : '');

	let copied = $state('');

	function inviteLink(token: string): string {
		return `${page.url.origin}/invite/${token}`;
	}

	async function copyInvite(token: string) {
		await navigator.clipboard.writeText(inviteLink(token));
		copied = token;
		setTimeout(() => (copied = ''), 1500);
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString();
	}

	type Member = (typeof data.users)[number];
	const memberColumns: ColumnDef<Member>[] = [
		{ accessorKey: 'name', header: 'Name' },
		{ accessorKey: 'email', header: 'Email' },
		{
			accessorKey: 'createdAt',
			header: 'Joined',
			cell: (info: CellContext<Member, unknown>) => fmtDateShort(String(info.getValue()))
		}
	];
	const members = createSvelteTable(() => ({ data: data.users, columns: memberColumns }));

	function renderCell(cell: { getValue: () => unknown; getContext: () => unknown; column: { columnDef: ColumnDef<Member> } }): string {
		const def = cell.column.columnDef.cell;
		if (typeof def === 'function') {
			return String(def(cell.getContext() as CellContext<Member, unknown>));
		}
		return String(cell.getValue() ?? '');
	}
</script>

<svelte:head>
	<title>Dashboard</title>
</svelte:head>

<h1>Manage services</h1>

{#if form?.message}<p class="notice">{form.message}</p>{/if}

<form method="POST" action="?/runChecks" use:enhance class="run-checks">
	<button type="submit">Run uptime checks now</button>
	<span class="hint">Cron also runs them every minute in production</span>
</form>

<section class="card new">
	<h2>Site settings</h2>
	<form
		method="POST"
		action="?/saveSiteSettings"
		enctype="multipart/form-data"
		use:enhance
		class="site-form"
	>
		<div class="row-form two">
			<label class="field">
				Title
				<input type="text" name="title" value={data.site.title} required />
			</label>
			<label class="field">
				Description
				<input type="text" name="description" value={data.site.description} />
			</label>
		</div>
		<div class="field">
			<span class="field-label">Brand icon</span>
			<IconPicker name="icon" value={data.site.icon} />
		</div>
		<div class="row-form two">
			<label class="field">
				Or upload a logo (PNG/JPEG/WebP/GIF/SVG, max 256 KB — also used as favicon)
				<input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" />
			</label>
			{#if data.site.imageId !== null}
				<label class="checkline current">
					<Visual imageId={data.site.imageId} alt="Current logo" size={24} />
					<input type="checkbox" name="removeImage" />
					Remove current logo
				</label>
			{/if}
		</div>
		<button type="submit">Save site settings</button>
	</form>
</section>

<section class="grid">
	{#each data.services as service (service.id)}
		<div class="card">
			<div class="card-head">
				<strong>{service.name}</strong>
				<form method="POST" action="?/delete" use:enhance>
					<input type="hidden" name="id" value={service.id} />
					<button class="danger small" type="submit">Delete</button>
				</form>
			</div>
			{#if service.description}<p class="desc">{service.description}</p>{/if}

			<form method="POST" action="?/editService" use:enhance class="row-form edit-service">
				<input type="hidden" name="id" value={service.id} />
				<input type="text" name="name" value={service.name} required />
				<input type="text" name="description" value={service.description ?? ''} placeholder="Description" />
				<input type="number" name="sortOrder" value={service.sortOrder} step="1" title="Sort order" />
				<button type="submit" class="small">Save</button>
			</form>

			<form method="POST" action="?/updateStatus" use:enhance class="row-form">
				<input type="hidden" name="id" value={service.id} />
				<select name="status" value={service.status}>
					{#each Object.entries(STATUSES) as [value, meta] (value)}
						<option {value}>{meta.label}</option>
					{/each}
				</select>
				<input type="text" name="note" placeholder="Optional note (shown publicly)" />
				<button type="submit" class="small">Update</button>
			</form>

			<form method="POST" action="?/setMonitor" use:enhance class="row-form">
				<input type="hidden" name="id" value={service.id} />
				<input
					type="url"
					name="monitorUrl"
					placeholder="Health check URL, e.g. https://api.example.com/health"
					value={service.monitorUrl ?? ''}
				/>
				<button type="submit" class="small">Save monitor</button>
			</form>

			<details class="visual-details">
				<summary>
					Icon &amp; image
					{#if service.imageId !== null || service.icon}
						<span class="preview">
							<Visual imageId={service.imageId} icon={service.icon} alt="" size={16} />
						</span>
					{/if}
				</summary>
				<form
					method="POST"
					action="?/setServiceVisual"
					enctype="multipart/form-data"
					use:enhance
					class="site-form"
				>
					<input type="hidden" name="id" value={service.id} />
					<IconPicker name="icon" value={service.icon} />
					<div class="row-form two">
						<label class="field">
							Or upload an image (max 256 KB)
							<input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" />
						</label>
						{#if service.imageId !== null}
							<label class="checkline current">
								<Visual imageId={service.imageId} alt="Current image" size={20} />
								<input type="checkbox" name="removeImage" />
								Remove current image
							</label>
						{/if}
					</div>
					<button type="submit" class="small">Save visual</button>
				</form>
			</details>
		</div>
	{:else}
		<p>No services yet — add your first one below.</p>
	{/each}
</section>

<section class="card new">
	<h2>Add a service</h2>
	<form method="POST" action="?/create" use:enhance class="create-form">
		<input type="text" name="name" placeholder="Service name" required />
		<input type="text" name="description" placeholder="Description (optional)" />
		<input type="url" name="monitorUrl" placeholder="Health check URL (optional)" />
		<button type="submit">Add service</button>
	</form>
</section>

<h1 class="section">Incidents &amp; maintenance</h1>

{#if open.length > 0}
	<section class="grid">
		{#each open as incident (incident.id)}
			<div class="card">
				<div class="card-head">
					<strong><a href="/incident/{incident.id}">{incident.title}</a></strong>
					<div class="head-side">
						<span class="chip" style:--c={INCIDENT_SEVERITIES[incident.severity].color}>
							{INCIDENT_SEVERITIES[incident.severity].label}
						</span>
						<span class="chip" style:--c={INCIDENT_STATUSES[incident.status].color}>
							{INCIDENT_STATUSES[incident.status].label}
						</span>
						<form method="POST" action="?/deleteIncident" use:enhance>
							<input type="hidden" name="id" value={incident.id} />
							<button class="danger small" type="submit">Delete</button>
						</form>
					</div>
				</div>

				{#if incident.type === 'maintenance' && incident.scheduledStart && incident.scheduledEnd}
					<p class="desc">
						Window: {fmtDateTime(incident.scheduledStart)} &rarr; {fmtDateTime(incident.scheduledEnd)}
						&middot; starts/ends automatically
					</p>
				{/if}
				{#if incident.services.length > 0}
					<p class="affected">
						{#each incident.services as s (s.serviceId)}
							<span class="chip small" style:--c={STATUSES[s.impact].color}>
								{s.serviceName}: {STATUSES[s.impact].label}
							</span>
						{/each}
					</p>
				{/if}

				<form method="POST" action="?/editIncident" use:enhance class="row-form">
					<input type="hidden" name="id" value={incident.id} />
					<input type="text" name="title" value={incident.title} required />
					{#if incident.type === 'incident'}
						<select name="severity" value={incident.severity}>
							{#each incidentSeverities as [value, meta] (value)}
								<option {value}>{meta.label}</option>
							{/each}
						</select>
					{:else}
						<input type="hidden" name="severity" value="maintenance" />
					{/if}
					<button type="submit" class="small">Save</button>
				</form>

				<form method="POST" action="?/updateIncident" use:enhance class="row-form">
					<input type="hidden" name="id" value={incident.id} />
					{#if incident.type === 'incident'}
						<input type="hidden" name="restore" value="on" />
					{/if}
					<select name="status" value={incident.status}>
						{#each STATUS_FLOWS[incident.type] as value (value)}
							<option {value}>{INCIDENT_STATUSES[value].label}</option>
						{/each}
					</select>
					<input type="text" name="message" placeholder="Update message (shown publicly)" required />
					<button type="submit" class="small">Post update</button>
				</form>
				{#if incident.type === 'incident' && incident.services.length > 0}
					<p class="hint-line">Resolving restores affected services to operational.</p>
				{/if}

				{#if incident.updates.length > 0}
					<ul class="mini-timeline">
						{#each incident.updates as update (update.id)}
							<li>
								<span class="chip small" style:--c={INCIDENT_STATUSES[update.status].color}>
									{INCIDENT_STATUSES[update.status].label}
								</span>
								<span class="msg">{update.message}</span>
								<form method="POST" action="?/deleteUpdate" use:enhance>
									<input type="hidden" name="updateId" value={update.id} />
									<button class="link-danger" type="submit" title="Delete update">✕</button>
								</form>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/each}
	</section>
{:else}
	<p class="desc">No active incidents or upcoming maintenance.</p>
{/if}

{#if data.incidents.resolved.length > 0}
	<section class="card new">
		<h2>Recently closed</h2>
		<div class="grid">
			{#each data.incidents.resolved as incident (incident.id)}
				<div class="closed">
					<div class="card-head">
						<strong><a href="/incident/{incident.id}">{incident.title}</a></strong>
						<div class="head-side">
							<span class="chip small" style:--c={INCIDENT_STATUSES[incident.status].color}>
								{INCIDENT_STATUSES[incident.status].label}
							</span>
							<form method="POST" action="?/deleteIncident" use:enhance>
								<input type="hidden" name="id" value={incident.id} />
								<button class="danger small" type="submit">Delete</button>
							</form>
						</div>
					</div>
					<form method="POST" action="?/savePostmortem" use:enhance class="postmortem">
						<input type="hidden" name="id" value={incident.id} />
						<textarea name="postmortem" rows="2" placeholder="Postmortem (shown on the public incident page)"
							>{incident.postmortem ?? ''}</textarea
						>
						<button type="submit" class="small">Save postmortem</button>
					</form>
				</div>
			{/each}
		</div>
	</section>
{/if}

<section class="card new">
	<h2>Open an incident</h2>
	<form method="POST" action="?/openIncident" use:enhance class="incident-form">
		<input type="text" name="title" placeholder="Incident title" required />
		<div class="row-form">
			<select name="severity">
				{#each incidentSeverities as [value, meta] (value)}
					<option {value}>{meta.label}</option>
				{/each}
			</select>
			<select name="impact">
				{#each IMPACT_LEVELS as value (value)}
					<option {value}>Impact: {STATUSES[value].label}</option>
				{/each}
			</select>
		</div>
		<fieldset>
			<legend>Affected services</legend>
			{#each data.services as service (service.id)}
				<label class="checkline">
					<input type="checkbox" name="services" value={service.id} />
					{service.name}
				</label>
			{/each}
		</fieldset>
		<label class="checkline">
			<input type="checkbox" name="cascade" checked />
			Set affected services to the impact level now
		</label>
		<textarea name="message" rows="2" placeholder="Initial update (shown publicly)" required
		></textarea>
		<button type="submit">Open incident</button>
	</form>
</section>

<section class="card new">
	<h2>Schedule maintenance</h2>
	<form method="POST" action="?/scheduleMaintenance" use:enhance class="incident-form">
		<input type="text" name="title" placeholder="Maintenance title" required />
		<div class="row-form">
			<label class="dt">
				Starts
				<input type="datetime-local" bind:value={maintStart} required />
			</label>
			<label class="dt">
				Ends
				<input type="datetime-local" bind:value={maintEnd} required />
			</label>
		</div>
		<input type="hidden" name="scheduledStart" value={maintStartIso} />
		<input type="hidden" name="scheduledEnd" value={maintEndIso} />
		<fieldset>
			<legend>Affected services (set to “Under maintenance” during the window)</legend>
			{#each data.services as service (service.id)}
				<label class="checkline">
					<input type="checkbox" name="services" value={service.id} />
					{service.name}
				</label>
			{/each}
		</fieldset>
		<textarea name="message" rows="2" placeholder="Announcement (optional, shown publicly)"
		></textarea>
		<button type="submit">Schedule maintenance</button>
	</form>
</section>

<h1 class="section">Team &amp; access</h1>

<section class="card">
	<div class="card-head">
		<div>
			<strong>Open sign-up</strong>
			<p class="desc">
				{data.signupsOpen
					? 'Anyone can create an account from the sign-in page.'
					: 'Closed — new members need an invitation link.'}
			</p>
		</div>
		<form method="POST" action="?/toggleSignups" use:enhance>
			<input type="hidden" name="open" value={data.signupsOpen ? '0' : '1'} />
			<button type="submit" class="small" class:danger={data.signupsOpen}>
				{data.signupsOpen ? 'Close sign-up' : 'Open sign-up'}
			</button>
		</form>
	</div>
</section>

<section class="card new">
	<h2>Invitations</h2>
	<form method="POST" action="?/createInvite" use:enhance class="create-form">
		<input type="text" name="note" placeholder="Note, e.g. who it's for (optional)" />
		<button type="submit">Create invite link</button>
	</form>
	{#if data.invitations.length > 0}
		<ul class="invites">
			{#each data.invitations as inv (inv.token)}
				<li>
					<div class="invite-info">
						<code>…{inv.token.slice(-8)}</code>
						{#if inv.note}<span>{inv.note}</span>{/if}
						{#if inv.usedAt}
							<span class="used">used by {inv.usedBy}</span>
						{:else if new Date(inv.expiresAt) < new Date()}
							<span class="used">expired {fmtDate(inv.expiresAt)}</span>
						{:else}
							<span class="pending">expires {fmtDate(inv.expiresAt)}</span>
						{/if}
					</div>
					<div class="invite-actions">
						{#if !inv.usedAt}
							<button class="small" type="button" onclick={() => copyInvite(inv.token)}>
								{copied === inv.token ? 'Copied!' : 'Copy link'}
							</button>
						{/if}
						<form method="POST" action="?/revokeInvite" use:enhance>
							<input type="hidden" name="token" value={inv.token} />
							<button class="danger small" type="submit">
								{inv.usedAt ? 'Remove' : 'Revoke'}
							</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="card new">
	<h2>Members</h2>
	<table class="members-table">
		<thead>
			{#each members.table.getHeaderGroups() as headerGroup (headerGroup.id)}
				<tr>
					{#each headerGroup.headers as header (header.id)}
						<th>
							<button
								type="button"
								class="th-sort"
								onclick={(e) => header.column.getToggleSortingHandler()?.(e)}
							>
								{header.column.columnDef.header}
								{header.column.getIsSorted() === 'asc'
									? '↑'
									: header.column.getIsSorted() === 'desc'
										? '↓'
										: ''}
							</button>
						</th>
					{/each}
				</tr>
			{/each}
		</thead>
		<tbody>
			{#each members.table.getRowModel().rows as row (row.id)}
				<tr>
					{#each row.getVisibleCells() as cell (cell.id)}
						<td>{renderCell(cell)}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style>
	h1 {
		font-size: 1.4rem;
	}
	.invites {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.invites li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.8rem;
		flex-wrap: wrap;
	}
	.invite-info {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
	}
	.invite-info code {
		color: #93c5fd;
		background: #0d1424;
		padding: 0.15rem 0.4rem;
		border-radius: 5px;
	}
	.invite-actions {
		display: flex;
		gap: 0.4rem;
	}
	.used {
		color: #64748b;
		font-size: 0.78rem;
	}
	.pending {
		color: #22c55e;
		font-size: 0.78rem;
	}
	.members-table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.8rem;
		font-size: 0.88rem;
	}
	.members-table th {
		text-align: left;
		border-bottom: 1px solid #2a3550;
		padding: 0.3rem 0.6rem 0.3rem 0;
	}
	.th-sort {
		background: none;
		color: #94a3b8;
		padding: 0;
		font-weight: 600;
		font-size: 0.8rem;
	}
	.th-sort:hover {
		background: none;
		color: #e5e9f0;
	}
	.members-table td {
		padding: 0.45rem 0.6rem 0.45rem 0;
		border-bottom: 1px solid #16203a;
		color: #cbd5e1;
	}
	h1.section {
		margin-top: 2.2rem;
	}
	.notice {
		color: #93c5fd;
	}
	.run-checks {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		margin-bottom: 1.2rem;
	}
	.hint {
		font-size: 0.78rem;
		color: #64748b;
	}
	.grid {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.card {
		background: #101828;
		border: 1px solid #1e293b;
		border-radius: 10px;
		padding: 1rem 1.2rem;
	}
	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.desc {
		color: #94a3b8;
		font-size: 0.85rem;
		margin: 0.3rem 0 0;
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
	.row-form {
		display: grid;
		grid-template-columns: 200px 1fr auto;
		gap: 0.5rem;
		margin-top: 0.8rem;
	}
	.row-form:has(input[name='monitorUrl']) {
		grid-template-columns: 1fr auto;
	}
	.row-form.edit-service {
		grid-template-columns: 1fr 1fr 80px auto;
	}
	@media (max-width: 640px) {
		.row-form.edit-service {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 640px) {
		.row-form,
		.row-form:has(input[name='monitorUrl']) {
			grid-template-columns: 1fr;
		}
	}
	button.small {
		padding: 0.4rem 0.8rem;
		font-size: 0.85rem;
	}
	.new {
		margin-top: 1.5rem;
	}
	.new h2 {
		margin-top: 0;
		font-size: 1.05rem;
	}
	.create-form {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.create-form input {
		flex: 1;
		min-width: 180px;
	}
	.incident-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.incident-form .row-form {
		margin-top: 0;
		grid-template-columns: 1fr 1fr;
	}
	.incident-form button {
		align-self: flex-start;
	}
	.head-side {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.affected {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin: 0.6rem 0 0;
	}
	.mini-timeline {
		list-style: none;
		margin: 0.8rem 0 0;
		padding: 0.6rem 0 0;
		border-top: 1px solid #1e293b;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.mini-timeline li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 0.85rem;
	}
	.mini-timeline .msg {
		flex: 1;
		color: #cbd5e1;
	}
	.link-danger {
		background: none;
		color: #64748b;
		padding: 0 0.3rem;
		font-weight: 400;
	}
	.link-danger:hover {
		background: none;
		color: #fca5a5;
	}
	.hint-line {
		color: #64748b;
		font-size: 0.75rem;
		margin: 0.3rem 0 0;
	}
	fieldset {
		border: 1px solid #1e293b;
		border-radius: 8px;
		padding: 0.6rem 0.8rem;
		display: flex;
		gap: 0.9rem;
		flex-wrap: wrap;
	}
	legend {
		font-size: 0.78rem;
		color: #94a3b8;
		padding: 0 0.3rem;
	}
	.checkline {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: #cbd5e1;
	}
	.checkline input {
		width: auto;
	}
	.dt {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: #94a3b8;
	}
	.closed + .closed {
		border-top: 1px solid #1e293b;
		padding-top: 0.8rem;
	}
	.postmortem {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}
	.postmortem button {
		align-self: flex-start;
	}
	.site-form {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.site-form button {
		align-self: flex-start;
	}
	.row-form.two {
		grid-template-columns: 1fr 1fr;
		margin-top: 0;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: #94a3b8;
	}
	.field-label {
		font-size: 0.8rem;
		color: #94a3b8;
	}
	.checkline.current {
		align-self: end;
		padding-bottom: 0.4rem;
	}
	.visual-details {
		margin-top: 0.8rem;
		border-top: 1px solid #1e293b;
		padding-top: 0.6rem;
	}
	.visual-details summary {
		cursor: pointer;
		font-size: 0.82rem;
		color: #94a3b8;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.visual-details form {
		margin-top: 0.7rem;
	}
	.preview {
		display: inline-flex;
		color: #cbd5e1;
	}
</style>
