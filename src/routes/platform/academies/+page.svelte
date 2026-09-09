<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string; success?: boolean };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();

	function formatTrialEndsAt(iso: string): string {
		return new Date(iso).toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			timeZone: 'Asia/Seoul'
		});
	}
</script>

<section class="max-w-5xl">
	<p class="text-sm text-gray-500">
		<a href={resolve('/platform')} class="font-medium text-indigo-600 hover:text-indigo-800"
			>← 플랫폼</a
		>
	</p>
	<h1 class="mt-2 text-2xl font-semibold text-gray-900">등록 학원</h1>
	<p class="mt-2 text-sm text-gray-600">
		새 학원을 만들면 현재 계정에 <span class="font-medium text-gray-800">super_admin</span> 멤버십이
		붙습니다. 사이드바
		<span class="font-medium text-gray-800">활성 학원</span>에서 전환할 수 있습니다.
	</p>

	{#if form?.error}
		<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
			{form.error}
		</p>
	{/if}

	<form method="POST" action="?/createAcademy" class="mt-6 flex max-w-xl flex-wrap items-end gap-2">
		<div class="min-w-0 flex-1">
			<label for="new-academy-name" class="block text-xs font-medium text-gray-600"
				>새 학원 이름</label
			>
			<input
				id="new-academy-name"
				name="name"
				type="text"
				maxlength="120"
				required
				class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
				placeholder="예: 강남 2캠퍼스"
			/>
		</div>
		<button
			type="submit"
			class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
		>
			학원 추가
		</button>
	</form>

	{#if data.dbError}
		<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			{data.dbError}
		</p>
	{:else}
		<div class="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
			<table class="min-w-full divide-y divide-gray-200 text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-2 text-left font-medium text-gray-700">이름</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">상태</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">기능 플래그</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">ID</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">멤버</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">작업</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each data.rows as row (row.id)}
						<tr>
							<td class="px-4 py-2 font-medium text-gray-900">{row.name}</td>
							<td class="px-4 py-2 text-gray-700">
								{#if row.status === 'trial'}
									<span
										class="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800"
										>체험 (trial)</span
									>
									{#if row.trialEndsAt}
										<p class="mt-1 text-xs text-gray-500">
											종료: {formatTrialEndsAt(row.trialEndsAt)}
										</p>
									{/if}
								{:else}
									{row.status}
								{/if}
							</td>
							<td class="px-4 py-2">
								<form
									method="POST"
									action="?/updateFlags"
									class="flex flex-col gap-1 text-xs text-gray-700"
								>
									<input type="hidden" name="academyId" value={row.id} />
									<label class="inline-flex items-center gap-1.5">
										<input
											type="checkbox"
											name="billingAutoImport"
											checked={row.billingAutoImport}
											class="h-3.5 w-3.5"
										/>
										입금 자동화
									</label>
									<label class="inline-flex items-center gap-1.5">
										<input
											type="checkbox"
											name="parentPortalEnabled"
											checked={row.parentPortalEnabled}
											class="h-3.5 w-3.5"
										/>
										학부모 포털
									</label>
									<label class="inline-flex items-center gap-1.5">
										<input
											type="checkbox"
											name="communicationsEnabled"
											checked={row.communicationsEnabled}
											class="h-3.5 w-3.5"
										/>
										소통·공지
									</label>
									<button
										type="submit"
										class="mt-1 w-fit rounded bg-gray-100 px-2 py-1 font-medium text-gray-700 hover:bg-gray-200"
									>
										저장
									</button>
								</form>
							</td>
							<td class="px-4 py-2 font-mono text-xs text-gray-600">{row.id}</td>
							<td class="px-4 py-2">
								<a
									href={resolve(`/platform/academies/${row.id}/members`)}
									class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
								>
									관리
								</a>
							</td>
							<td class="px-4 py-2">
								{#if row.status === 'active' && row.id !== data.defaultAcademyIdHex}
									<form method="POST" action="?/deactivateAcademy" class="inline">
										<input type="hidden" name="academyId" value={row.id} />
										<button
											type="submit"
											class="text-sm font-medium text-amber-700 hover:text-amber-900"
										>
											비활성화
										</button>
									</form>
								{:else if row.status === 'inactive'}
									<form method="POST" action="?/reactivateAcademy" class="inline">
										<input type="hidden" name="academyId" value={row.id} />
										<button
											type="submit"
											class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
										>
											다시 활성화
										</button>
									</form>
								{:else if row.status === 'trial'}
									<span class="text-xs text-gray-500">문의 큐에서 정식 전환</span>
								{:else if row.id === data.defaultAcademyIdHex}
									<span class="text-xs text-gray-500">기본 개발 학원</span>
								{:else}
									<span class="text-xs text-gray-400">—</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td class="px-4 py-6 text-center text-gray-500" colspan="6"
								>등록된 학원이 없습니다.</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
