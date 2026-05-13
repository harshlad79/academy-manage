<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string; success?: boolean };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();

	const today = new Date().toISOString().slice(0, 10);
</script>

<section>
	<h1 class="text-2xl font-semibold text-gray-900">보강</h1>
	<p class="mt-1 text-sm text-gray-500">
		PRD §8 보강 일정(날짜·선택 시간·설명)을 수강 단위로 등록합니다. 강사는 담당 클래스 수강만
		다룹니다.
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
		{#if form?.success}
			<p
				class="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
			>
				처리했습니다.
			</p>
		{/if}

		<form method="GET" class="mt-6 flex flex-wrap items-end gap-4">
			<div>
				<label for="courseId" class="block text-xs font-medium text-gray-600">클래스 필터</label>
				<select
					id="courseId"
					name="courseId"
					class="mt-1 min-w-[14rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				>
					<option value="">전체</option>
					{#each data.courses as c (c.id)}
						<option value={c.id} selected={data.courseFilterId === c.id}>{c.name}</option>
					{/each}
				</select>
			</div>
			<button
				type="submit"
				class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
			>
				적용
			</button>
		</form>

		{#if data.enrollmentOptions.length === 0}
			<p class="mt-6 text-sm text-gray-600">
				보강을 등록할 수강이 없습니다. 권한·수강 연결을 확인하거나
				<a class="text-indigo-600 hover:text-indigo-800" href={resolve('/enrollments')}>수강 관리</a
				>에서 등록하세요.
			</p>
		{:else}
			<form method="POST" action="?/create" class="mt-8 space-y-4" use:enhance>
				<h2 class="text-lg font-medium text-gray-900">보강 등록</h2>
				<div class="flex flex-wrap gap-4">
					<div class="min-w-[18rem] flex-1">
						<label for="enrollmentId" class="block text-xs font-medium text-gray-600">수강</label>
						<select
							id="enrollmentId"
							name="enrollmentId"
							required
							class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
						>
							<option value="">— 수강 선택 —</option>
							{#each data.enrollmentOptions as o (o.id)}
								<option value={o.id}>{o.label}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="sessionDate" class="block text-xs font-medium text-gray-600">보강일</label>
						<input
							id="sessionDate"
							name="sessionDate"
							type="date"
							required
							value={today}
							class="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
						/>
					</div>
					<div>
						<label for="sessionTime" class="block text-xs font-medium text-gray-600"
							>시간 (선택, HH:mm)</label
						>
						<input
							id="sessionTime"
							name="sessionTime"
							type="time"
							class="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
						/>
					</div>
				</div>
				<div>
					<label for="description" class="block text-xs font-medium text-gray-600">설명</label>
					<textarea
						id="description"
						name="description"
						required
						rows="3"
						maxlength="2000"
						placeholder="보강 내용·장소 등"
						class="mt-1 w-full max-w-2xl rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					></textarea>
				</div>
				<button
					type="submit"
					class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
				>
					등록
				</button>
			</form>
		{/if}

		<div class="mt-10">
			<h2 class="text-lg font-semibold text-gray-900">등록된 보강</h2>
			{#if data.rows.length === 0}
				<p class="mt-2 text-sm text-gray-600">표시할 보강 일정이 없습니다.</p>
			{:else}
				<div class="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
					<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-4 py-3 font-medium text-gray-700">학생</th>
								<th class="px-4 py-3 font-medium text-gray-700">클래스</th>
								<th class="px-4 py-3 font-medium text-gray-700">보강일</th>
								<th class="px-4 py-3 font-medium text-gray-700">시간</th>
								<th class="px-4 py-3 font-medium text-gray-700">설명</th>
								<th class="px-4 py-3 font-medium text-gray-700"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each data.rows as row (row.id)}
								<tr class="hover:bg-gray-50">
									<td class="px-4 py-3 font-medium text-gray-900">{row.studentName}</td>
									<td class="px-4 py-3 text-gray-800">{row.courseName}</td>
									<td class="px-4 py-3 whitespace-nowrap text-gray-800">{row.sessionDate}</td>
									<td class="px-4 py-3 whitespace-nowrap text-gray-800">{row.sessionTime || '—'}</td
									>
									<td class="max-w-md px-4 py-3 text-gray-700">{row.description}</td>
									<td class="px-4 py-3">
										<form method="POST" action="?/delete" use:enhance>
											<input type="hidden" name="id" value={row.id} />
											<button type="submit" class="text-sm text-red-700 hover:text-red-900">
												삭제
											</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</section>
