<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type AttRow = PageData['recentAttendance'][number];
	type PayRow = PageData['paymentHistory'][number];

	let receiptToPrint = $state<PayRow | null>(null);

	onMount(() => {
		const clear = () => {
			receiptToPrint = null;
		};
		window.addEventListener('afterprint', clear);
		return () => window.removeEventListener('afterprint', clear);
	});

	function won(n: number) {
		return n.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' });
	}

	function attendanceLabel(status: AttRow['status']) {
		switch (status) {
			case 'present':
				return '출석';
			case 'late':
				return '지각';
			case 'absent':
				return '결석';
		}
	}

	function badgeClass(status: AttRow['status']) {
		switch (status) {
			case 'present':
				return 'bg-green-100 text-green-900';
			case 'late':
				return 'bg-amber-100 text-amber-900';
			case 'absent':
				return 'bg-red-100 text-red-900';
		}
	}

	function paymentMethodLabel(method: PayRow['method']) {
		switch (method) {
			case 'manual':
				return '수기 등록';
			case 'bank_import':
				return '은행 거래';
		}
	}

	async function printReceipt(row: PayRow) {
		receiptToPrint = row;
		await tick();
		window.print();
	}
</script>

<section class="max-w-3xl print:hidden">
	<h1 class="text-2xl font-semibold text-gray-900">내 자녀</h1>
	<p class="mt-2 text-sm">
		<a href={resolve('/p/settings')} class="font-medium text-indigo-600 hover:text-indigo-800"
			>연락처 · 알림 설정</a
		>
	</p>
	<p class="mt-2 text-sm text-gray-600">
		연결된 학생·수강·미납 청구·납부 이력·최근 출결을 확인합니다. 수정은 학원 관리자에게 문의하세요.
	</p>

	{#if data.academyOperationalStatus === 'inactive'}
		<p
			class="mt-4 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-900"
			role="status"
		>
			이 학원은 <strong>비활성</strong> 상태입니다. 아래 내용은 열람용이며, 운영·수납 문의는 학원에 직접
			확인하세요.
		</p>
	{/if}

	{#if data.earliestOpenDueDate}
		<p
			class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
			role="status"
		>
			가장 빠른 납부 기한은
			<strong class="font-mono">{data.earliestOpenDueDate}</strong>
			입니다. 아래 미납 청구를 확인하세요.
		</p>
	{/if}

	{#if data.students.length === 0}
		<p class="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			등록된 자녀가 없습니다. 학원에서 학부모–자녀 연결 후 다시 확인하세요.
		</p>
	{:else}
		<ul class="mt-6 space-y-4">
			{#each data.students as st (st.id)}
				<li class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
					<h2 class="text-lg font-medium text-gray-900">
						{st.name}{#if st.grade}<span class="font-normal text-gray-500">
								&nbsp;·&nbsp;{st.grade}</span
							>{/if}
					</h2>
					{#if st.enrollments.length === 0}
						<p class="mt-2 text-sm text-gray-500">등록된 수강이 없습니다.</p>
					{:else}
						<p class="mt-2 text-xs font-medium text-gray-500">수강 클래스</p>
						<ul class="mt-1 list-inside list-disc text-sm text-gray-700">
							{#each st.enrollments as en (en.id)}
								<li>{en.courseName}</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>

		<div class="mt-10">
			<h2 class="text-lg font-semibold text-gray-900">미납 청구</h2>
			<p class="mt-1 text-sm text-gray-500">연결 자녀의 수강에 대한 미납 항목만 표시됩니다.</p>
			{#if data.openInvoiceLines.length === 0}
				<p class="mt-4 text-sm text-gray-600">미납 청구가 없습니다.</p>
			{:else}
				<div class="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
					<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-3 py-2 font-medium text-gray-700">학생</th>
								<th class="px-3 py-2 font-medium text-gray-700">클래스</th>
								<th class="px-3 py-2 font-medium text-gray-700">설명</th>
								<th class="px-3 py-2 font-medium text-gray-700">금액</th>
								<th class="px-3 py-2 font-medium text-gray-700">납부 기한</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each data.openInvoiceLines as line (line.id)}
								<tr class="hover:bg-gray-50">
									<td class="px-3 py-2 text-gray-900">{line.studentName}</td>
									<td class="px-3 py-2 text-gray-600">{line.courseName}</td>
									<td class="px-3 py-2 text-gray-600">{line.description}</td>
									<td class="px-3 py-2 font-medium text-gray-900">{won(line.amountKrw)}</td>
									<td class="px-3 py-2 text-gray-600">{line.dueDate}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="mt-10">
			<h2 class="text-lg font-semibold text-gray-900">납부 이력</h2>
			<p class="mt-1 text-sm text-gray-500">
				등록된 수납 내역입니다. 최대 {data.paymentHistoryCap}건, 수납일시 내림차순입니다.
			</p>
			{#if data.paymentHistory.length === 0}
				<p class="mt-4 text-sm text-gray-600">납부 이력이 없습니다.</p>
			{:else}
				<div class="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
					<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-3 py-2 font-medium text-gray-700">수납일시</th>
								<th class="px-3 py-2 font-medium text-gray-700">학생</th>
								<th class="px-3 py-2 font-medium text-gray-700">클래스</th>
								<th class="px-3 py-2 font-medium text-gray-700">청구 항목</th>
								<th class="px-3 py-2 font-medium text-gray-700">금액</th>
								<th class="px-3 py-2 font-medium text-gray-700">방식</th>
								<th class="px-3 py-2 font-medium text-gray-700">거래참조</th>
								<th class="px-3 py-2 font-medium text-gray-700">비고</th>
								<th class="px-3 py-2 font-medium text-gray-700">영수증</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each data.paymentHistory as row (row.id)}
								<tr class="hover:bg-gray-50">
									<td class="px-3 py-2 whitespace-nowrap text-gray-900">{row.paidAtLabel}</td>
									<td class="px-3 py-2 text-gray-900">{row.studentName}</td>
									<td class="px-3 py-2 text-gray-600">{row.courseName}</td>
									<td class="px-3 py-2 text-gray-600">{row.description}</td>
									<td class="px-3 py-2 font-medium text-gray-900">{won(row.amountKrw)}</td>
									<td class="px-3 py-2 whitespace-nowrap text-gray-600">
										{paymentMethodLabel(row.method)}
									</td>
									<td
										class="max-w-[10rem] truncate px-3 py-2 whitespace-nowrap text-gray-600"
										title={row.externalRef ?? ''}
									>
										{#if row.externalRef}
											<span class="font-mono text-xs">{row.externalRef}</span>
										{:else}
											<span class="text-gray-400">—</span>
										{/if}
									</td>
									<td class="max-w-[12rem] truncate px-3 py-2 text-gray-600" title={row.note ?? ''}>
										{row.note ?? '—'}
									</td>
									<td class="px-3 py-2 whitespace-nowrap">
										<button
											type="button"
											class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
											aria-label={`${row.studentName} 납부 영수증 인쇄`}
											onclick={() => printReceipt(row)}
										>
											영수증
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="mt-10">
			<h2 class="text-lg font-semibold text-gray-900">최근 출결</h2>
			<p class="mt-1 text-sm text-gray-500">
				최대 {data.recentAttendanceCap}건, 수업일 기준 내림차순입니다.
			</p>
			{#if data.recentAttendance.length === 0}
				<p class="mt-4 text-sm text-gray-600">기록된 출결이 없습니다.</p>
			{:else}
				<div class="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
					<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-3 py-2 font-medium text-gray-700">수업일</th>
								<th class="px-3 py-2 font-medium text-gray-700">학생</th>
								<th class="px-3 py-2 font-medium text-gray-700">클래스</th>
								<th class="px-3 py-2 font-medium text-gray-700">상태</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each data.recentAttendance as row (row.id)}
								<tr class="hover:bg-gray-50">
									<td class="px-3 py-2 text-gray-900">{row.sessionDate}</td>
									<td class="px-3 py-2 text-gray-900">{row.studentName}</td>
									<td class="px-3 py-2 text-gray-600">{row.courseName}</td>
									<td class="px-3 py-2">
										<span
											class={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass(row.status)}`}
											>{attendanceLabel(row.status)}</span
										>
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

{#if receiptToPrint}
	{@const r = receiptToPrint}
	<div class="hidden print:block" aria-hidden="true">
		<div class="mx-auto max-w-md px-6 py-8 text-gray-900">
			<h2 class="text-center text-xl font-bold">{data.academyDisplayName}</h2>
			<p class="mt-1 text-center text-sm text-gray-600">납부 영수증</p>
			<dl class="mt-8 space-y-3 text-sm">
				<div class="flex justify-between gap-4 border-b border-gray-200 pb-2">
					<dt class="text-gray-600">납부일시</dt>
					<dd class="text-right font-medium">{r.paidAtLabel}</dd>
				</div>
				<div class="flex justify-between gap-4 border-b border-gray-200 pb-2">
					<dt class="text-gray-600">학생</dt>
					<dd class="text-right font-medium">{r.studentName}</dd>
				</div>
				<div class="flex justify-between gap-4 border-b border-gray-200 pb-2">
					<dt class="text-gray-600">클래스</dt>
					<dd class="text-right font-medium">{r.courseName}</dd>
				</div>
				<div class="flex justify-between gap-4 border-b border-gray-200 pb-2">
					<dt class="text-gray-600">청구 항목</dt>
					<dd class="text-right font-medium">{r.description}</dd>
				</div>
				<div class="flex justify-between gap-4 border-b border-gray-200 pb-2">
					<dt class="text-gray-600">금액</dt>
					<dd class="text-right font-medium">{won(r.amountKrw)}</dd>
				</div>
				<div class="flex justify-between gap-4 border-b border-gray-200 pb-2">
					<dt class="text-gray-600">납부 방식</dt>
					<dd class="text-right font-medium">{paymentMethodLabel(r.method)}</dd>
				</div>
				<div class="flex justify-between gap-4 border-b border-gray-200 pb-2">
					<dt class="text-gray-600">거래참조</dt>
					<dd class="text-right font-mono text-xs font-medium">{r.externalRef ?? '—'}</dd>
				</div>
				<div class="flex justify-between gap-4 pb-2">
					<dt class="text-gray-600">수납번호</dt>
					<dd class="text-right font-mono text-xs font-medium break-all">{r.id}</dd>
				</div>
			</dl>
		</div>
	</div>
{/if}

<style>
	@media print {
		:global(aside.w-64.shrink-0) {
			display: none !important;
		}
		:global(main.flex-1) {
			padding: 0 !important;
			background: white !important;
		}
		:global(.min-h-screen.bg-gray-50) {
			min-height: auto !important;
			background: white !important;
		}
	}
</style>
