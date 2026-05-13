<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string; success?: boolean };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();

	const statusOptions = [
		{ value: 'present', label: '출석' },
		{ value: 'late', label: '지각' },
		{ value: 'absent', label: '결석' }
	] as const;
</script>

<section>
	<h1 class="text-2xl font-semibold text-gray-900">출결</h1>
	<p class="mt-1 text-sm text-gray-500">
		클래스·수강생 기준으로 날짜별 출석·지각·결석을 기록합니다. 날짜는 Asia/Seoul 기준입니다.
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
				저장했습니다.
			</p>
		{/if}

		{#if data.courses.length === 0}
			<p class="mt-6 text-sm text-gray-600">
				등록된 클래스가 없습니다. <a
					class="text-indigo-600 hover:text-indigo-800"
					href={resolve('/courses')}>클래스 관리</a
				>에서 먼저 추가하세요.
			</p>
		{:else}
			<form method="GET" class="mt-6 flex flex-wrap items-end gap-4">
				<div>
					<label for="courseId" class="block text-xs font-medium text-gray-600">클래스</label>
					<select
						id="courseId"
						name="courseId"
						class="mt-1 min-w-[14rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					>
						{#each data.courses as c (c.id)}
							<option value={c.id} selected={data.selectedCourseId === c.id}>{c.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="date" class="block text-xs font-medium text-gray-600">수업일</label>
					<input
						id="date"
						type="date"
						name="date"
						value={data.sessionDate}
						class="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					/>
				</div>
				<button
					type="submit"
					class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
				>
					불러오기
				</button>
			</form>

			{#if data.rows.length === 0}
				<p class="mt-6 text-sm text-gray-600">
					이 클래스에 수강 등록된 학생이 없습니다.
					<a class="text-indigo-600 hover:text-indigo-800" href={resolve('/enrollments')}
						>수강 관리</a
					>에서 연결하세요.
				</p>
			{:else}
				<form method="POST" action="?/save" class="mt-6 space-y-4">
					<input type="hidden" name="courseId" value={data.selectedCourseId} />
					<input type="hidden" name="sessionDate" value={data.sessionDate} />

					<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
						<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-4 py-3 font-medium text-gray-700">학생</th>
									<th class="px-4 py-3 font-medium text-gray-700">출결</th>
									<th class="min-w-[12rem] px-4 py-3 font-medium text-gray-700">사유</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each data.rows as row (row.enrollmentId)}
									<tr class="hover:bg-gray-50">
										<td class="px-4 py-3 font-medium text-gray-900">{row.studentName}</td>
										<td class="px-4 py-3">
											<select
												name="status_{row.enrollmentId}"
												class="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
											>
												{#each statusOptions as opt (opt.value)}
													<option value={opt.value} selected={row.status === opt.value}>
														{opt.label}
													</option>
												{/each}
											</select>
										</td>
										<td class="px-4 py-3">
											<input
												type="text"
												name="reason_{row.enrollmentId}"
												value={row.reason}
												maxlength="500"
												placeholder="지각·결석 시 선택"
												class="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
											/>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<button
						type="submit"
						class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
					>
						저장
					</button>
				</form>

				<div class="mt-10">
					<h2 class="text-lg font-semibold text-gray-900">변경 이력 (감사)</h2>
					<p class="mt-1 text-sm text-gray-500">
						출결 상태·사유가 실제로 바뀐 경우에만 기록됩니다. actor는 Better Auth 사용자 id입니다.
					</p>
					{#if data.auditTrail.length === 0}
						<p class="mt-3 text-sm text-gray-600">이 수업일·클래스에 대한 수정 기록이 없습니다.</p>
					{:else}
						<div class="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
							<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
								<thead class="bg-gray-50">
									<tr>
										<th class="px-4 py-3 font-medium text-gray-700">시각</th>
										<th class="px-4 py-3 font-medium text-gray-700">학생</th>
										<th class="px-4 py-3 font-medium text-gray-700">변경</th>
										<th class="px-4 py-3 font-medium text-gray-700">사유</th>
										<th class="px-4 py-3 font-medium text-gray-700">actor</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-100">
									{#each data.auditTrail as ev (ev.id)}
										<tr class="hover:bg-gray-50">
											<td class="px-4 py-3 whitespace-nowrap text-gray-800">
												{new Date(ev.createdAt).toLocaleString('ko-KR', {
													dateStyle: 'short',
													timeStyle: 'medium'
												})}
											</td>
											<td class="px-4 py-3 font-medium text-gray-900">{ev.studentName}</td>
											<td class="px-4 py-3 text-gray-800">{ev.changeSummary}</td>
											<td
												class="max-w-xs truncate px-4 py-3 text-gray-600"
												title={ev.reasonHint ?? ''}
											>
												{ev.reasonHint ?? '—'}
											</td>
											<td class="px-4 py-3 text-gray-600">{ev.actorUserId}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	{/if}
</section>
