<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string; success?: boolean };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();
</script>

<section>
	<h1 class="text-2xl font-semibold text-gray-900">수강 관리</h1>
	<p class="mt-1 text-sm text-gray-500">
		학생과 클래스를 연결합니다. PRD 기준 청구 단위는 학생 × 수강(Enrollment)입니다.
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

		<form method="GET" class="mt-6 flex flex-wrap items-end gap-3">
			<div>
				<label for="f-student" class="block text-xs font-medium text-gray-600">학생</label>
				<select
					id="f-student"
					name="studentId"
					class="mt-1 min-w-[10rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				>
					<option value="">전체</option>
					{#each data.students as s (s.id)}
						<option value={s.id} selected={data.filterStudentId === s.id}>{s.name}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="f-course" class="block text-xs font-medium text-gray-600">클래스</label>
				<select
					id="f-course"
					name="courseId"
					class="mt-1 min-w-[10rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				>
					<option value="">전체</option>
					{#each data.courses as c (c.id)}
						<option value={c.id} selected={data.filterCourseId === c.id}>{c.name}</option>
					{/each}
				</select>
			</div>
			<button
				type="submit"
				class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
			>
				필터
			</button>
			{#if data.filterStudentId || data.filterCourseId}
				<a class="text-sm text-indigo-600 hover:text-indigo-800" href={resolve('/enrollments')}>
					필터 초기화
				</a>
			{/if}
		</form>

		<form
			method="POST"
			action="?/create"
			class="mt-6 flex flex-wrap items-end gap-3 border-t border-gray-200 pt-6"
		>
			<div>
				<label for="new-student" class="block text-xs font-medium text-gray-600">학생</label>
				<select
					id="new-student"
					name="studentId"
					required
					class="mt-1 min-w-[12rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				>
					<option value="" disabled selected>선택</option>
					{#each data.students as s (s.id)}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="new-course" class="block text-xs font-medium text-gray-600">클래스</label>
				<select
					id="new-course"
					name="courseId"
					required
					class="mt-1 min-w-[12rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				>
					<option value="" disabled selected>선택</option>
					{#each data.courses as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</div>
			<button
				type="submit"
				class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
			>
				수강 등록
			</button>
		</form>

		<div class="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
			<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 font-medium text-gray-700">학생</th>
						<th class="px-4 py-3 font-medium text-gray-700">클래스</th>
						<th class="w-28 px-4 py-3 font-medium text-gray-700">학생 편집</th>
						<th class="w-40 px-4 py-3 font-medium text-gray-700">작업</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each data.enrollments as row (row.id)}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3">
								<a
									href={resolve(`/enrollments?studentId=${row.studentId}`)}
									class="font-medium text-indigo-600 hover:text-indigo-800"
								>
									{row.studentName}
								</a>
							</td>
							<td class="px-4 py-3">
								<a
									href={resolve(`/enrollments?courseId=${row.courseId}`)}
									class="font-medium text-indigo-600 hover:text-indigo-800"
								>
									{row.courseName}
								</a>
							</td>
							<td class="px-4 py-3">
								{#if row.studentId}
									<a
										href={resolve(`/students/${row.studentId}/edit`)}
										class="text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-2 hover:text-indigo-600"
									>
										편집
									</a>
								{:else}
									<span class="text-sm text-gray-400">—</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								<form
									method="POST"
									action="?/delete"
									class="inline"
									use:enhance={({ cancel }) => {
										if (
											!confirm(`「${row.studentName}」→「${row.courseName}」수강을 삭제할까요?`)
										) {
											cancel();
										}
									}}
								>
									<input type="hidden" name="id" value={row.id} />
									<button type="submit" class="text-sm font-medium text-red-600 hover:text-red-800">
										삭제
									</button>
								</form>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="4" class="px-4 py-8 text-center text-gray-500">
								{#if data.filterStudentId || data.filterCourseId}
									필터에 맞는 수강이 없습니다.
								{:else}
									등록된 수강이 없습니다.
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
