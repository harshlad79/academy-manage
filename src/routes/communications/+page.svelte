<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<section class="max-w-2xl">
	<h1 class="text-2xl font-semibold text-gray-900">소통 · 공지</h1>
	<p class="mt-2 text-sm text-gray-600">
		MVP 단계에서 계획된 학부모 대상 공지·알림은 현재 준비 중입니다. 연동 일정이 정해지면 이 화면에서
		안내하겠습니다.
	</p>

	{#if data.dbError}
		<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			{data.dbError}
		</p>
	{/if}

	<div class="mt-6 grid gap-4 sm:grid-cols-3">
		<div
			class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
			aria-labelledby="communications-parent-link-stat-heading"
		>
			<h2 id="communications-parent-link-stat-heading" class="text-sm font-medium text-gray-700">
				학부모–자녀 연결
			</h2>
			<p class="mt-2 text-3xl font-semibold tracking-tight text-gray-900 tabular-nums">
				{data.parentStudentLinkCount.toLocaleString('ko-KR')}
			</p>
			<p class="mt-2 text-xs text-gray-600">
				등록된 연결 건수. 공지 타게팅의 기초 데이터(MVP 준비 중).
			</p>
		</div>
		<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-medium text-gray-700">학부모 계정(멤버십)</h2>
			<p class="mt-2 text-3xl font-semibold tracking-tight text-gray-900 tabular-nums">
				{data.parentMembershipCount.toLocaleString('ko-KR')}
			</p>
			<p class="mt-2 text-xs text-gray-600">
				이 학원에 <code class="font-mono text-[11px]">parent</code> 역할로 등록된 사용자 수입니다.
			</p>
		</div>
		<div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
			<h2 class="text-sm font-medium text-gray-700">학생 수</h2>
			<p class="mt-2 text-3xl font-semibold tracking-tight text-gray-900 tabular-nums">
				{data.studentCount.toLocaleString('ko-KR')}
			</p>
			<p class="mt-2 text-xs text-gray-600">학원에 등록된 학생 문서 수입니다.</p>
		</div>
	</div>

	<p class="mt-6 text-sm text-gray-600">
		연결 관리는
		<a class="font-medium text-indigo-600 hover:text-indigo-800" href={resolve('/students')}>
			학생 관리
		</a>
		에서 학생 편집 화면으로 이동해 학부모 계정을 지정할 수 있습니다.
	</p>

	<p class="mt-4 text-sm">
		<a class="font-medium text-indigo-600 hover:text-indigo-800" href={resolve('/')}>
			대시보드로 돌아가기
		</a>
	</p>
</section>
