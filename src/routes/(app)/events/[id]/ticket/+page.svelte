<script lang="ts">
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';

	let { data } = $props();
</script>

<div class="mx-auto mt-8 max-w-sm text-center">
	<div class="glass rounded-2xl p-8">
		{#if data.checkedIn}
			<CheckCircleIcon size={40} weight="fill" class="mx-auto mb-3 text-green-600" />
			<p class="text-sm font-medium text-neutral-900">Already checked in</p>
		{:else}
			<img src={data.qrDataUrl} alt="Your event ticket QR code" class="mx-auto rounded-xl" />
			<p class="mt-4 text-sm text-neutral-500">Show this at the door</p>
		{/if}
	</div>
</div>
