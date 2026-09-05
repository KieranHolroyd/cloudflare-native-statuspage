<script lang="ts">
	import { ICONS, ICON_NAMES } from '$lib/icons';

	/**
	 * Radio-grid lucide icon picker. Submits as a regular form field via the
	 * hidden radios, so it works inside SvelteKit form actions.
	 */
	let { name, value = null }: { name: string; value?: string | null } = $props();

	// svelte-ignore state_referenced_locally -- seed the field from the initial prop value only
	let selected = $state(value ?? '');
</script>

<div class="picker" role="radiogroup" aria-label="Choose an icon">
	<label class="cell" class:active={selected === ''} title="No icon">
		<input type="radio" {name} value="" bind:group={selected} />
		<span class="none">—</span>
	</label>
	{#each ICON_NAMES as iconName (iconName)}
		{@const IconComponent = ICONS[iconName]}
		<label class="cell" class:active={selected === iconName} title={iconName}>
			<input type="radio" {name} value={iconName} bind:group={selected} />
			<IconComponent size={16} />
		</label>
	{/each}
</div>

<style>
	.picker {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.cell {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border: 1px solid #2a3550;
		border-radius: 6px;
		background: #0d1424;
		color: #94a3b8;
		cursor: pointer;
	}
	.cell:hover {
		color: #e5e9f0;
		border-color: #3b82f6;
	}
	.cell.active {
		color: #93c5fd;
		border-color: #3b82f6;
		background: #16233f;
	}
	.cell input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.none {
		font-size: 0.8rem;
	}
</style>
