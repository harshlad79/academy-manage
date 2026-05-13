<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function won(n: number) {
		return n.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' });
	}
</script>

<section class="max-w-5xl">
	<p class="text-sm text-gray-500">
		<a href={resolve('/reports')} class="font-medium text-indigo-600 hover:text-indigo-800"
			>← 리포트</a
		>
	</p>
	<h1 class="mt-2 text-2xl font-semibold text-gray-900">클래스별 정산 요약</h1>
	<p class="mt-2 text-sm text-gray-600">
		선택한 월에 <span class="font-medium text-gray-800">수납 기록이 잡힌 금액</span>(납부 처리·입금
		매칭 모두)과, 기준 시점의
		<span class="font-medium text-gray-800">미납 청구 잔액</span>을 클래스(강좌) 단위로 묶었습니다.
	</p>

	{#if data.dbError}
		<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			{data.dbError}
		</p>
	{:else}
		{#if data.scopeWarning}
			<p
				class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
			>
				{data.scopeWarning}
			</p>
		{/if}
		{#if data.monthInvalid}
			<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
				달 입력이 올바르지 않아 이번 달(<code class="font-mono text-xs">{data.monthParam}</code>)
				기준으로 보여 드립니다.
			</p>
		{/if}

		<div class="mt-6 flex flex-wrap items-end gap-3">
			<form method="GET" class="flex flex-wrap items-end gap-3">
				<div>
					<label for="month" class="block text-xs font-medium text-gray-600">집계 월</label>
					<input
						id="month"
						name="month"
						type="month"
						value={data.monthParam}
						class="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					/>
				</div>
				<button
					type="submit"
					class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
				>
					적용
				</button>
			</form>
			<form method="GET" action={resolve('/reports/course-revenue/export')} class="inline">
				<input type="hidden" name="month" value={data.monthParam} />
				<button
					type="submit"
					class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
				>
					CSV 다운로드
				</button>
			</form>
		</div>

		{#if data.rows.length === 0}
			<p class="mt-8 text-sm text-gray-600">
				표시할 클래스가 없거나, 해당 기간·범위에 집계할 데이터가 없습니다.
			</p>
		{:else}
			<div class="mt-8 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
				<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 font-medium text-gray-700">클래스</th>
							<th class="px-4 py-3 font-medium text-gray-700">강사</th>
							<th class="px-4 py-3 font-medium text-gray-700">
								월 수납 건수<br />
								<span class="text-xs font-normal text-gray-500">({data.monthParam})</span>
							</th>
							<th class="px-4 py-3 font-medium text-gray-700">월 수납 합계</th>
							<th class="px-4 py-3 font-medium text-gray-700">미납 건수</th>
							<th class="px-4 py-3 font-medium text-gray-700">미납 합계</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each data.rows as row (row.courseId)}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-3 font-medium text-gray-900">{row.courseName}</td>
								<td class="px-4 py-3 text-gray-600">{row.teacherName}</td>
								<td class="px-4 py-3 text-gray-900">{row.paidCount}</td>
								<td class="px-4 py-3 font-medium text-gray-900">{won(row.paidTotalKrw)}</td>
								<td class="px-4 py-3 text-gray-900">{row.openCount}</td>
								<td class="px-4 py-3 font-medium text-gray-900">{won(row.openTotalKrw)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<p class="mt-8 text-xs text-gray-500">
			강사 계정은 본인 담당 클래스만 집계됩니다. 수납·청구 화면은
			<a class="text-indigo-600 hover:text-indigo-800" href={resolve('/payments')}>수납</a>에서
			처리하세요.
		</p>
	{/if}
</section>
