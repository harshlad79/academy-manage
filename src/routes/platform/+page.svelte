<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<section class="max-w-3xl">
	<h1 class="text-2xl font-semibold text-gray-900">플랫폼</h1>
	<p class="mt-2 text-sm text-gray-600">
		전체관리자 전용 영역입니다. 학원(Academy) 엔티티 관리와 이후 다학원 전환 작업이 여기로 모입니다.
	</p>
	<ul class="mt-6 space-y-2 text-sm">
		<li>
			<a
				href={resolve('/platform/inquiries')}
				class="font-medium text-indigo-600 hover:text-indigo-800">학원 등록 문의 큐 →</a
			>
		</li>
		<li>
			<a
				href={resolve('/platform/academies')}
				class="font-medium text-indigo-600 hover:text-indigo-800">등록 학원 목록 →</a
			>
		</li>
	</ul>
</section>
