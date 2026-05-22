<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form?: ActionData } = $props();
</script>

<section class="mx-auto max-w-md px-4 py-16">
	<h1 class="text-xl font-semibold text-gray-900">약관 동의</h1>
	<p class="mt-2 text-sm text-gray-600">서비스 이용을 위해 아래 약관에 동의해 주세요.</p>

	{#if form?.error}
		<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
			{form.error}
		</p>
	{/if}

	<form method="POST" action="?/accept" class="mt-6 space-y-4">
		<label class="flex items-start gap-2 text-sm text-gray-700">
			<input type="checkbox" name="agree" required class="mt-0.5" />
			<span>서비스 이용약관 및 개인정보 처리방침에 동의합니다.</span>
		</label>
		<button
			type="submit"
			class="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
		>
			동의하고 계속
		</button>
	</form>
</section>
