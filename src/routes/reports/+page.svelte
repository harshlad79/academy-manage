<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<section class="max-w-3xl">
	<h1 class="text-2xl font-semibold text-gray-900">리포트</h1>
	<p class="mt-2 text-sm text-gray-600">
		학원 운영·정산을 위한 집계 화면입니다. 항목을 선택하면 상세 페이지로 이동합니다.
	</p>

	<ul class="mt-8 space-y-3">
		<li>
			<a
				href={resolve('/reports/course-revenue')}
				class="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
			>
				<p class="text-sm font-semibold text-gray-900">클래스별 정산 요약</p>
				<p class="mt-1 text-sm text-gray-600">
					월별 수납 합계와 미납 청구 잔액을 클래스(강좌) 단위로 확인합니다. 강사는 담당 클래스만
					표시됩니다.
				</p>
				<p class="mt-2 text-sm font-medium text-indigo-600">열기 →</p>
			</a>
		</li>
	</ul>
</section>
