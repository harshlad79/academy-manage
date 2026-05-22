<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();
</script>

<section class="mx-auto max-w-lg px-4 py-16">
	{#if form?.error}
		<p class="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
			{form.error}
		</p>
	{/if}

	{#if data.kind === 'missing'}
		<h1 class="text-xl font-semibold text-gray-900">초대 링크가 없습니다</h1>
		<p class="mt-2 text-sm text-gray-600">
			<code class="font-mono">token</code> 쿼리가 필요합니다.
		</p>
	{:else if data.kind === 'invalid'}
		<h1 class="text-xl font-semibold text-gray-900">유효하지 않은 초대</h1>
		<p class="mt-2 text-sm text-gray-600">링크가 잘못되었거나 이미 철회·수락되었습니다.</p>
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

		{#if data.acceptUi === 'need_login'}
			<p
				class="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
			>
				<strong>로그인 필요:</strong> 초대 이메일(<span class="font-mono">{data.email}</span>)과
				같은 계정으로 로그인·가입한 뒤 이 페이지에서 수락하세요.
			</p>
			<form method="GET" action={resolve('/auth/sign-in')} class="mt-4">
				<input type="hidden" name="callbackURL" value={data.inviteReturnPath} />
				<input type="hidden" name="inviteEmail" value={data.email} />
				<button
					type="submit"
					class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
				>
					{data.isMockAuth ? '목업 로그인 안내' : '카카오로 계속'}
				</button>
			</form>
			{#if !data.isMockAuth}
				<p class="mt-3 text-xs text-gray-600">
					네이버·구글도 가능. 초대 이메일과 같은 소셜 계정으로 로그인하세요.
				</p>
			{/if}
			{#if data.isMockAuth && data.mockUserIdHint}
				<p class="mt-3 text-xs text-gray-600">
					목업: <code class="font-mono">AUTH_MOCK_USER_ID={data.mockUserIdHint}</code> 로 서버 재시작
					후 이 페이지를 새로고침하세요.
				</p>
			{:else if data.isMockAuth}
				<p class="mt-3 text-xs text-gray-600">
					목업: 초대 이메일과 맞는 프로필이 없으면 live 모드 가입 또는 시드 이메일로 초대를
					보내세요.
				</p>
			{/if}
		{:else if data.acceptUi === 'no_session_email'}
			<p class="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
				현재 세션 계정에 이메일이 없어 초대를 검증할 수 없습니다. 관리자에게 문의하세요.
			</p>
		{:else if data.acceptUi === 'email_mismatch'}
			<p
				class="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
			>
				<strong>이메일 불일치:</strong> 이 초대는 <span class="font-mono">{data.email}</span>로
				발급되었습니다. 초대와 같은 이메일의 계정으로 로그인한 뒤 다시 시도하세요.
			</p>
			<form method="GET" action={resolve('/auth/sign-in')} class="mt-4">
				<input type="hidden" name="callbackURL" value={data.inviteReturnPath} />
				<input type="hidden" name="inviteEmail" value={data.email} />
				<button
					type="submit"
					class="rounded-md border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
				>
					{data.isMockAuth ? '다른 계정으로 로그인 · 가입' : '카카오로 계속'}
				</button>
			</form>
			{#if !data.isMockAuth}
				<p class="mt-3 text-xs text-gray-600">
					네이버·구글도 가능. 초대 이메일과 같은 소셜 계정으로 로그인하세요.
				</p>
			{/if}
		{:else}
			<form method="POST" action="?/acceptInvite" class="mt-8 space-y-4">
				<input type="hidden" name="token" value={data.token} />
				<p class="text-sm text-gray-700">
					아래 버튼을 누르면 이 학원에 멤버십이 생성되고 초대 링크는 더 이상 사용할 수 없습니다.
				</p>
				<button
					type="submit"
					class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
				>
					초대 수락 · 멤버십 생성
				</button>
			</form>
		{/if}
	{/if}
</section>
