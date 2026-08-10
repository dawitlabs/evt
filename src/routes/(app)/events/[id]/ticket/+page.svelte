<script lang="ts">
	let { data } = $props();
</script>

<div class="mx-auto mt-16 max-w-sm text-center">
	{#if data.checkedIn}
		<p class="text-sm font-medium text-green-600">Already checked in</p>
	{:else}
		<img src={data.qrDataUrl} alt="Your event ticket QR code" class="mx-auto rounded" />
		<p class="mt-3 text-sm text-gray-500">Show this at the door</p>
	{/if}
</div>
