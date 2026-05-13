<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string; success?: boolean };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();
</script>

<section class="max-w-lg">
	<h1 class="text-2xl font-semibold text-gray-900">학생 수정</h1>
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
				value={data.student.name}
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
			/>
		</div>
		<div>
			<label for="grade" class="block text-sm font-medium text-gray-700">학년</label>
			<input
				id="grade"
				name="grade"
				maxlength="40"
				value={data.student.grade}
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				placeholder="예: 고1"
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
				href={resolve('/students')}
				class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				취소
			</a>
		</div>
	</form>

	<div class="mt-10 border-t border-gray-200 pt-6">
		<h2 class="text-lg font-semibold text-gray-900">학부모 연결</h2>
		<p class="mt-1 text-sm text-gray-500">
			학원의 학부모 계정과 이 학생을 연결합니다. 학부모는 연결된 자녀의 데이터만 볼 수 있습니다.
		</p>

		<div class="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
			<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 font-medium text-gray-700">학부모 계정</th>
						<th class="w-28 px-4 py-3 font-medium text-gray-700">작업</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each data.linkedParents as p (p.parentUserId)}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 font-mono text-xs text-gray-700">{p.parentUserId}</td>
							<td class="px-4 py-3">
								<form
									method="POST"
									action="?/unlinkParent"
									class="inline"
									use:enhance={({ cancel }) => {
										if (!confirm(`「${p.parentUserId}」 연결을 해제할까요?`)) cancel();
									}}
								>
									<input type="hidden" name="parentUserId" value={p.parentUserId} />
									<button type="submit" class="text-sm font-medium text-red-600 hover:text-red-800">
										연결 해제
									</button>
								</form>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="2" class="px-4 py-6 text-center text-sm text-gray-500">
								연결된 학부모가 없습니다.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<form method="POST" action="?/linkParent" class="mt-4 flex flex-wrap items-end gap-3">
			<div class="flex-1">
				<label for="parent-select" class="block text-xs font-medium text-gray-600">
					새 학부모 연결
				</label>
				<select
					id="parent-select"
					name="parentUserId"
					required
					class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				>
					<option value="" disabled selected>학부모 계정을 선택하세요</option>
					{#each data.candidateParents as p (p.parentUserId)}
						<option value={p.parentUserId}>{p.parentUserId}</option>
					{/each}
				</select>
			</div>
			<button
				type="submit"
				disabled={data.candidateParents.length === 0}
				class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-300"
			>
				연결
			</button>
		</form>
		{#if data.candidateParents.length === 0}
			<p class="mt-2 text-xs text-gray-500">
				연결 가능한 학부모 계정이 없습니다. 학원의 학부모 멤버십을 먼저 추가하세요.
			</p>
		{/if}
	</div>
</section>
