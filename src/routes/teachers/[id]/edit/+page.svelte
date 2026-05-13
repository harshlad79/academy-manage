<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string; success?: boolean };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();
</script>

<section class="max-w-lg">
	<h1 class="text-2xl font-semibold text-gray-900">강사 수정</h1>
	<p class="mt-1 text-sm text-gray-500">학원 스코프 내에서만 수정됩니다.</p>

	{#if form?.error}
		<p
			class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
			role="alert"
		>
			{form.error}
		</p>
	{/if}

	<form method="POST" action="?/update" class="mt-6 space-y-4">
		<div>
			<label for="name" class="block text-sm font-medium text-gray-700">이름</label>
			<input
				id="name"
				name="name"
				required
				maxlength="120"
				value={data.teacher.name}
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
			/>
		</div>
		<div>
			<label for="subject" class="block text-sm font-medium text-gray-700">담당 과목</label>
			<input
				id="subject"
				name="subject"
				maxlength="80"
				value={data.teacher.subject}
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				placeholder="예: 수학"
			/>
		</div>
		<div class="flex gap-3 pt-2">
			<button
				type="submit"
				class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
			>
				저장
			</button>
			<a
				href={resolve('/teachers')}
				class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				취소
			</a>
		</div>
	</form>
</section>
