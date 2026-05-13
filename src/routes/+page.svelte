<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();

	function won(n: number) {
		return n.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' });
	}
</script>

<section class="max-w-5xl">
	<h1 class="text-2xl font-semibold text-gray-900">대시보드</h1>
	<p class="mt-1 text-sm text-gray-600">학원 운영 현황을 한눈에 확인하고 각 메뉴로 이동합니다.</p>

	{#if form?.error}
		<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
			{form.error}
		</p>
	{/if}

	{#if data.dbError}
		<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			{data.dbError}
		</p>
	{/if}

	<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<a
			href={resolve('/students')}
			class="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
		>
			<p class="text-xs font-medium tracking-wide text-gray-500 uppercase">학생</p>
			<p class="mt-2 text-3xl font-semibold text-gray-900 tabular-nums">
				{data.studentCount.toLocaleString('ko-KR')}
			</p>
			<p class="mt-2 text-sm font-medium text-indigo-600 group-hover:text-indigo-800">
				학생 관리 →
			</p>
		</a>

		<a
			href={resolve('/courses')}
			class="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
		>
			<p class="text-xs font-medium tracking-wide text-gray-500 uppercase">클래스</p>
			<p class="mt-2 text-3xl font-semibold text-gray-900 tabular-nums">
				{data.courseCount.toLocaleString('ko-KR')}
			</p>
			<p class="mt-2 text-sm font-medium text-indigo-600 group-hover:text-indigo-800">
				클래스 관리 →
			</p>
		</a>

		<a
			href={resolve('/enrollments')}
			class="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
		>
			<p class="text-xs font-medium tracking-wide text-gray-500 uppercase">수강</p>
			<p class="mt-2 text-3xl font-semibold text-gray-900 tabular-nums">
				{data.enrollmentCount.toLocaleString('ko-KR')}
			</p>
			<p class="mt-2 text-sm font-medium text-indigo-600 group-hover:text-indigo-800">
				수강 관리 →
			</p>
		</a>

		<a
			href={resolve('/payments')}
			class="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
		>
			<p class="text-xs font-medium tracking-wide text-gray-500 uppercase">미납 청구</p>
			<p class="mt-2 text-3xl font-semibold text-gray-900 tabular-nums">
				{data.openInvoiceCount.toLocaleString('ko-KR')}
			</p>
			<p class="mt-1 text-sm text-gray-600 tabular-nums">
				합계 {won(data.openInvoiceTotalKrw)}
			</p>
			{#if data.unmatchedDepositCount > 0}
				<p class="mt-1 text-sm font-medium text-amber-700 tabular-nums">
					미매칭 입금 {data.unmatchedDepositCount.toLocaleString('ko-KR')}건
				</p>
			{/if}
			<p class="mt-2 text-sm font-medium text-indigo-600 group-hover:text-indigo-800">
				수납 · 청구 →
			</p>
		</a>
	</div>

	<div class="mt-4 grid gap-4 sm:grid-cols-2">
		<a
			href={resolve('/makeups')}
			class="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
		>
			<p class="text-xs font-medium tracking-wide text-gray-500 uppercase">보강 기록</p>
			<p class="mt-2 text-3xl font-semibold text-gray-900 tabular-nums">
				{data.makeupSessionCount.toLocaleString('ko-KR')}
			</p>
			<p class="mt-2 text-sm font-medium text-indigo-600 group-hover:text-indigo-800">
				보강 관리 →
			</p>
		</a>
		<a
			href={resolve('/teachers')}
			class="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
		>
			<p class="text-xs font-medium tracking-wide text-gray-500 uppercase">강사</p>
			<p class="mt-2 text-3xl font-semibold text-gray-900 tabular-nums">
				{data.teacherCount.toLocaleString('ko-KR')}
			</p>
			<p class="mt-2 text-sm font-medium text-indigo-600 group-hover:text-indigo-800">
				강사 관리 →
			</p>
		</a>
	</div>
</section>
