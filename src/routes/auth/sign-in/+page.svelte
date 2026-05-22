<script lang="ts">
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import type { SocialProviderId } from '$lib/server/auth-social';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mode = $state<'sign-in' | 'sign-up'>('sign-in');
	let email = $state('');
	$effect(() => {
		if (data.inviteEmail && email === '') {
			email = data.inviteEmail;
		}
	});
	let password = $state('');
	let name = $state('');
	let busy = $state(false);
	let clientError = $state<string | null>(null);
	let returnToAcceptForm = $state<HTMLFormElement | null>(null);

	const inviteReturnPath = $derived(`${data.callbackPathname}${data.callbackSearch}`);

	const socialOrder: SocialProviderId[] = ['kakao', 'naver', 'google'];
	const orderedLiveSocial = $derived(
		socialOrder.filter((provider) => data.liveSocial.includes(provider))
	);

	const providerLabels: Record<SocialProviderId, string> = {
		kakao: '카카오로 계속',
		naver: '네이버로 계속',
		google: 'Google로 계속'
	};

	function socialButtonClass(provider: SocialProviderId): string {
		const base = 'w-full rounded-md px-4 py-3 text-sm font-medium disabled:opacity-60';
		switch (provider) {
			case 'kakao':
				return `${base} bg-[#FEE500] text-gray-900 hover:bg-[#f5dc00]`;
			case 'naver':
				return `${base} bg-[#03C75A] text-white hover:bg-[#02b351]`;
			case 'google':
				return `${base} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`;
		}
	}

	function submitReturnToAcceptForm() {
		returnToAcceptForm?.requestSubmit();
	}

	async function signInWith(provider: SocialProviderId) {
		clientError = null;
		busy = true;
		try {
			await authClient.signIn.social({
				provider,
				callbackURL: data.inviteEmail ? inviteReturnPath : '/'
			});
		} catch {
			clientError = '소셜 로그인을 시작하지 못했습니다.';
		} finally {
			busy = false;
		}
	}

	async function submitSignIn() {
		clientError = null;
		busy = true;
		try {
			const { error } = await authClient.signIn.email({
				email: email.trim(),
				password,
				callbackURL: inviteReturnPath
			});
			if (error) {
				clientError = error.message ?? '로그인에 실패했습니다.';
			}
		} finally {
			busy = false;
		}
	}

	async function submitSignUp() {
		clientError = null;
		busy = true;
		try {
			const { error } = await authClient.signUp.email({
				name: name.trim() || email.trim(),
				email: email.trim(),
				password,
				callbackURL: inviteReturnPath
			});
			if (error) {
				clientError = error.message ?? '가입에 실패했습니다.';
				return;
			}
			submitReturnToAcceptForm();
		} finally {
			busy = false;
		}
	}
</script>

<section class="mx-auto max-w-md px-4 py-16">
	<h1 class="text-xl font-semibold text-gray-900">로그인 · 가입</h1>
	{#if data.inviteEmail}
		<p class="mt-2 text-sm text-gray-600">
			초대 이메일: <span class="font-mono">{data.inviteEmail}</span>
		</p>
	{/if}

	{#if data.isMock}
		<div
			class="mt-6 space-y-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
		>
			<p>
				<strong>목업 모드</strong> (<code class="font-mono">AUTH_MODE=mock</code>): 이 페이지로는
				세션이 바뀌지 않습니다. <code class="font-mono">.env</code>의
				<code class="font-mono">AUTH_MOCK_USER_ID</code>를 바꾼 뒤 dev 서버를 재시작하세요.
			</p>
			{#if data.mockUserId}
				<p>
					이 초대와 이메일이 맞는 목업 ID: <strong class="font-mono">{data.mockUserId}</strong>
				</p>
			{:else}
				<p>
					이 초대 이메일과 일치하는 목업 프로필이 없습니다. live 모드에서 가입하거나 시드 이메일로
					초대를 보내세요.
				</p>
				<ul class="mt-2 list-inside list-disc font-mono text-xs">
					{#each data.mockProfiles as p (p.id)}
						<li>{p.id} → {p.email}</li>
					{/each}
				</ul>
			{/if}
			{#if data.callbackToken}
				<form method="GET" action={resolve('/invite/accept')} class="text-xs">
					<input type="hidden" name="token" value={data.callbackToken} />
					<button type="submit" class="font-medium text-indigo-700 underline">
						초대 수락 페이지로 돌아가기
					</button>
				</form>
			{/if}
		</div>
	{:else}
		{#if data.liveSocial.length === 0}
			<div
				class="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
			>
				OAuth 키 미설정 — mock 또는 <code class="font-mono">.env</code> 참고
			</div>
		{:else}
			<div class="mt-6 space-y-3">
				{#each orderedLiveSocial as provider (provider)}
					<button
						type="button"
						disabled={busy}
						class={socialButtonClass(provider)}
						onclick={() => void signInWith(provider)}
					>
						{providerLabels[provider]}
					</button>
				{/each}
			</div>
		{/if}

		{#if clientError}
			<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
				{clientError}
			</p>
		{/if}

		{#if data.inviteEmail}
			<div class="mt-6 flex gap-2 border-b border-gray-200">
				<button
					type="button"
					class="border-b-2 px-3 py-2 text-sm font-medium {mode === 'sign-in'
						? 'border-indigo-600 text-indigo-700'
						: 'border-transparent text-gray-600'}"
					onclick={() => (mode = 'sign-in')}
				>
					로그인
				</button>
				<button
					type="button"
					class="border-b-2 px-3 py-2 text-sm font-medium {mode === 'sign-up'
						? 'border-indigo-600 text-indigo-700'
						: 'border-transparent text-gray-600'}"
					onclick={() => (mode = 'sign-up')}
				>
					가입
				</button>
			</div>

			<form
				class="mt-6 space-y-4"
				onsubmit={(e) => {
					e.preventDefault();
					if (mode === 'sign-in') void submitSignIn();
					else void submitSignUp();
				}}
			>
				{#if mode === 'sign-up'}
					<div>
						<label for="auth-name" class="block text-xs font-medium text-gray-600">이름</label>
						<input
							id="auth-name"
							type="text"
							class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
							bind:value={name}
							autocomplete="name"
						/>
					</div>
				{/if}
				<div>
					<label for="auth-email" class="block text-xs font-medium text-gray-600">이메일</label>
					<input
						id="auth-email"
						type="email"
						required
						class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
						bind:value={email}
						autocomplete="email"
						readonly={!!data.inviteEmail}
					/>
				</div>
				<div>
					<label for="auth-password" class="block text-xs font-medium text-gray-600">비밀번호</label
					>
					<input
						id="auth-password"
						type="password"
						required
						minlength="8"
						class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
						bind:value={password}
						autocomplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
					/>
				</div>
				<button
					type="submit"
					disabled={busy}
					class="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
				>
					{busy ? '처리 중…' : mode === 'sign-in' ? '로그인 후 돌아가기' : '가입 후 돌아가기'}
				</button>
			</form>

			{#if data.callbackToken}
				<form
					bind:this={returnToAcceptForm}
					method="GET"
					action={resolve('/invite/accept')}
					class="mt-4 text-xs text-gray-500"
				>
					<input type="hidden" name="token" value={data.callbackToken} />
					<span>완료 후 </span>
					<button type="submit" class="text-indigo-600 underline">초대 수락 페이지</button>
					<span>에서 수락 버튼을 누르세요.</span>
				</form>
			{/if}
		{:else}
			<p class="mt-6 text-sm text-gray-600">
				자녀 연결 후 학부모 포털(<code class="font-mono">/p</code>)을 이용할 수 있습니다. 학원에서
				자녀 연결을 요청하세요.
			</p>
		{/if}
	{/if}
</section>
