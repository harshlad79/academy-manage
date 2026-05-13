<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string; success?: boolean };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();
</script>

<section>
	<h1 class="text-2xl font-semibold text-gray-900">학생 관리</h1>
	<p class="mt-1 text-sm text-gray-500">
		기본 학원 범위(DEV_ACADEMY_ID) 내 학생입니다. 이름으로 부분 검색할 수 있습니다.
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
					<a class="text-sm text-indigo-600 hover:text-indigo-800" href={resolve('/students')}>
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
						>새 학생 · 이름</label
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
					<label for="new-grade" class="block text-xs font-medium text-gray-600">학년</label>
					<input
						id="new-grade"
						name="grade"
						maxlength="40"
						class="mt-1 w-28 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
						placeholder="예: 고1"
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
						<th class="px-4 py-3 font-medium text-gray-700">학년</th>
						<th class="w-40 px-4 py-3 font-medium text-gray-700">작업</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each data.students as s (s.id)}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 text-gray-900">{s.name}</td>
							<td class="px-4 py-3 text-gray-600">{s.grade ?? '—'}</td>
							<td class="px-4 py-3">
								<div class="flex flex-wrap items-center gap-2">
									<a
										href={resolve(`/students/${s.id}/edit`)}
										class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
									>
										수정
									</a>
									<form
										method="POST"
										action="?/delete"
										class="inline"
										use:enhance={({ cancel }) => {
											if (!confirm(`「${s.name}」학생을 삭제할까요?`)) {
												cancel();
											}
										}}
									>
										<input type="hidden" name="id" value={s.id} />
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
									등록된 학생이 없습니다.
									<code class="rounded bg-gray-100 px-1">npm run seed</code> 로 시드를 넣을 수 있습니다.
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
