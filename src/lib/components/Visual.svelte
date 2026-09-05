<script lang="ts">
	import { ICONS, isIconName } from '$lib/icons';

	/** Renders a service/site visual: uploaded image wins, then lucide icon. */
	let {
		imageId = null,
		icon = null,
		alt = '',
		size = 20
	}: {
		imageId?: number | null;
		icon?: string | null;
		alt?: string;
		size?: number;
	} = $props();

	const IconComponent = $derived(icon && isIconName(icon) ? ICONS[icon] : null);
</script>

{#if imageId !== null}
	<img src="/img/{imageId}" {alt} width={size} height={size} class="visual" />
{:else if IconComponent}
	<IconComponent {size} aria-hidden="true" />
{/if}

<style>
	.visual {
		border-radius: 4px;
		object-fit: contain;
		display: block;
	}
</style>
