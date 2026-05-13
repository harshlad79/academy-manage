<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<section class="mx-auto max-w-lg px-4 py-16">
	{#if data.kind === 'missing'}
		<h1 class="text-xl font-semibold text-gray-900">초대 링크가 없습니다</h1>
		<p class="mt-2 text-sm text-gray-600">
			<code class="font-mono">token</code> 쿼리가 필요합니다.
		</p>
	{:else if data.kind === 'invalid'}
		<h1 class="text-xl font-semibold text-gray-900">유효하지 않은 초대</h1>
		<p class="mt-2 text-sm text-gray-600">링크가 잘못되었거나 이미 철회되었습니다.</p>
	{:else if data.kind === 'expired'}
		<h1 class="text-xl font-semibold text-gray-900">만료된 초대</h1>
		<p class="mt-2 text-sm text-gray-600">
			<span class="font-mono">{data.email}</span> 초대는 만료되었습니다. 학원 관리자에게 새 초대를 요청하세요.
		</p>
	{:else}
		<h1 class="text-xl font-semibold text-gray-900">학원 멤버십 초대</h1>
		<p class="mt-3 text-sm text-gray-700">
			<strong>{data.academyName}</strong>
			<span class="text-gray-500"> · 상태 {data.academyStatus}</span>
		</p>
		<ul class="mt-4 list-inside list-disc text-sm text-gray-700">
			<li>초대 이메일: <span class="font-mono">{data.email}</span></li>
			<li>부여 예정 역할: <span class="font-mono">{data.role}</span></li>
		</ul>
		<p class="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
			<strong>MVP 안내:</strong> 여기서 계정이 자동 생성되지는 않습니다. Better Auth로 가입한 뒤,
			플랫폼 관리자가 동일 학원에
			<code class="mx-0.5 font-mono text-xs">user.id</code>로 멤버십을 추가하는 흐름과 동일하게 후속
			연동할 수 있습니다.
		</p>
	{/if}
</section>
