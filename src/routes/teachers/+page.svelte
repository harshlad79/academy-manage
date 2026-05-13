<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string; success?: boolean };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();
</script>

<section>
	<h1 class="text-2xl font-semibold text-gray-900">강사 관리</h1>
	<p class="mt-1 text-sm text-gray-500">
		학원 스코프 내 강사입니다. 담당 클래스가 있는 강사는 삭제할 수 없습니다.
	</p>

	{#if data.dbError}
		<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			{data.dbError}
		</p>
	{:else}
		{#if form?.error}
			<p
				class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
				role="alert"
			>
				{form.error}
			</p>
		{/if}

		<div class="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
			<form method="GET" class="flex flex-wrap items-end gap-3">
				<div>
					<label for="q" class="block text-xs font-medium text-gray-600">검색(이름)</label>
					<input
						id="q"
						name="q"
						type="search"
						value={data.q}
						autocomplete="off"
						class="mt-1 min-w-[12rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
						placeholder="이름 일부"
					/>
				</div>
				<button
					type="submit"
					class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
				>
					검색
				</button>
				{#if data.q}
					<a class="text-sm text-indigo-600 hover:text-indigo-800" href={resolve('/teachers')}>
						필터 초기화
					</a>
				{/if}
			</form>

			<form
				method="POST"
				action="?/create"
				class="flex flex-wrap items-end gap-3 border-t border-gray-200 pt-6 lg:border-t-0 lg:pt-0"
			>
				<div>
					<label for="new-name" class="block text-xs font-medium text-gray-600"
						>새 강사 · 이름</label
					>
					<input
						id="new-name"
						name="name"
						required
						maxlength="120"
						class="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
						placeholder="이름"
					/>
				</div>
				<div>
					<label for="new-subject" class="block text-xs font-medium text-gray-600">담당 과목</label>
					<input
						id="new-subject"
						name="subject"
						maxlength="80"
						class="mt-1 w-36 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
						placeholder="예: 수학"
					/>
				</div>
				<button
					type="submit"
					class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
				>
					추가
				</button>
			</form>
		</div>

		<div class="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
			<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="w-[40%] px-4 py-3 font-medium text-gray-700">이름</th>
						<th class="px-4 py-3 font-medium text-gray-700">담당 과목</th>
						<th class="w-40 px-4 py-3 font-medium text-gray-700">작업</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each data.teachers as t (t.id)}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 text-gray-900">{t.name}</td>
							<td class="px-4 py-3 text-gray-600">{t.subject ?? '—'}</td>
							<td class="px-4 py-3">
								<div class="flex flex-wrap items-center gap-2">
									<a
										href={resolve(`/teachers/${t.id}/edit`)}
										class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
									>
										수정
									</a>
									<form
										method="POST"
										action="?/delete"
										class="inline"
										use:enhance={({ cancel }) => {
											if (!confirm(`「${t.name}」강사를 삭제할까요?`)) cancel();
										}}
									>
										<input type="hidden" name="id" value={t.id} />
										<button
											type="submit"
											class="text-sm font-medium text-red-600 hover:text-red-800"
										>
											삭제
										</button>
									</form>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="3" class="px-4 py-8 text-center text-gray-500">
								{#if data.q}
									검색 결과가 없습니다.
								{:else}
									등록된 강사가 없습니다.
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
