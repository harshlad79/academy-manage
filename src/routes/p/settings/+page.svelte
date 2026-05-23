<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form?: { error?: string } } = $props();
</script>

<section class="mx-auto max-w-lg px-4 py-8">
	<p class="text-sm text-gray-500">
		<a href={resolve('/p')} class="font-medium text-indigo-600 hover:text-indigo-800"
			>← 학부모 포털</a
		>
	</p>
	<h1 class="mt-2 text-2xl font-semibold text-gray-900">연락처 · 알림</h1>
	<p class="mt-1 text-sm text-gray-600">
		학원 공지·SMS 알림용 연락처입니다. 초대 SMS 번호와 달라도 됩니다.
	</p>

	{#if form?.error}
		<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
			{form.error}
		</p>
	{/if}

	{#if data.isMockAuth}
		<p class="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
			목업 모드에서는 프로필 저장이 비활성화되어 있습니다.
		</p>
	{/if}

	<form method="POST" action="?/save" class="mt-6 space-y-4">
		<div>
			<label for="phone" class="block text-sm font-medium text-gray-700">휴대번호</label>
			<input
				id="phone"
				name="phone"
				type="tel"
				value={data.phone}
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
				placeholder="01012345678"
				disabled={data.isMockAuth}
			/>
		</div>
		<label class="flex items-start gap-2 text-sm text-gray-700">
			<input
				type="checkbox"
				name="smsMarketingConsent"
				checked={data.smsConsent}
				disabled={data.isMockAuth}
				class="mt-1"
			/>
			<span>SMS로 학원 공지·안내를 받는 것에 동의합니다.</span>
		</label>
		<button
			type="submit"
			disabled={data.isMockAuth}
			class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-300"
		>
			저장
		</button>
	</form>
</section>
