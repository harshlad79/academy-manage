<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form?: { error?: string } } = $props();

	let pushBusy = $state(false);
	let pushMsg = $state('');

	function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
		const padding = '='.repeat((4 - (base64.length % 4)) % 4);
		const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
		const raw = atob(b64);
		const out = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
		return out;
	}

	async function subscribePush() {
		pushMsg = '';
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
			pushMsg = '이 브라우저는 푸시 알림을 지원하지 않습니다.';
			return;
		}
		pushBusy = true;
		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				pushMsg = '알림 권한이 거부되었습니다. 브라우저 설정에서 허용하세요.';
				return;
			}
			const reg = await navigator.serviceWorker.register('/sw.js');
			await navigator.serviceWorker.ready;
			let sub = await reg.pushManager.getSubscription();
			if (!sub) {
				sub = await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(data.vapidPublicKey)
				});
			}
			const jsonEl = document.getElementById('pushSubscriptionJson') as HTMLInputElement | null;
			const endpointEl = document.getElementById(
				'pushSubscriptionEndpoint'
			) as HTMLInputElement | null;
			if (jsonEl) jsonEl.value = JSON.stringify(sub.toJSON());
			if (endpointEl) endpointEl.value = sub.endpoint;
			pushMsg = '구독이 준비되었습니다. 아래 저장 버튼을 눌러 완료하세요.';
		} catch (e) {
			pushMsg = e instanceof Error ? e.message : '구독에 실패했습니다.';
		} finally {
			pushBusy = false;
		}
	}
</script>

<section class="mx-auto max-w-lg px-4 py-8">
	<p class="text-sm text-gray-500">
		<a href={resolve('/p')} class="font-medium text-indigo-600 hover:text-indigo-800"
			>← 학부모 포털</a
		>
	</p>
	<h1 class="mt-2 text-2xl font-semibold text-gray-900">연락처 · 알림</h1>
	<p class="mt-1 text-sm text-gray-600">
		납부 안내 등 학원 알림 수신 설정입니다. 계정 이메일은 로그인 주소입니다.
	</p>

	{#if form?.error}
		<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
			{form.error}
		</p>
	{/if}

	{#if data.isMockAuth}
		<p class="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
			목업 모드에서는 프로필 저장이 비활성화되어 있습니다.
		</p>
	{/if}

	<form method="POST" action="?/save" class="mt-6 space-y-5">
		<div>
			<label for="phone" class="block text-sm font-medium text-gray-700">휴대번호 (SMS)</label>
			<input
				id="phone"
				name="phone"
				type="tel"
				value={data.phone}
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
				placeholder="01012345678"
				disabled={data.isMockAuth}
			/>
		</div>
		<label class="flex items-start gap-2 text-sm text-gray-700">
			<input
				type="checkbox"
				name="smsMarketingConsent"
				checked={data.smsConsent}
				disabled={data.isMockAuth}
				class="mt-1"
			/>
			<span>SMS로 학원 공지·납부 안내를 받는 것에 동의합니다.</span>
		</label>

		<div class="border-t border-gray-100 pt-4">
			<p class="text-sm font-medium text-gray-800">이메일 알림</p>
			<p class="mt-0.5 text-xs text-gray-500">수신 주소: {data.accountEmail || '(없음)'}</p>
			<label class="mt-2 flex items-start gap-2 text-sm text-gray-700">
				<input
					type="checkbox"
					name="emailNotifyConsent"
					checked={data.emailConsent}
					disabled={data.isMockAuth}
					class="mt-1"
				/>
				<span>위 이메일로 납부·학원 안내 메일을 받는 것에 동의합니다.</span>
			</label>
		</div>

		<div class="border-t border-gray-100 pt-4">
			<p class="text-sm font-medium text-gray-800">푸시 알림</p>
			<label class="mt-2 flex items-start gap-2 text-sm text-gray-700">
				<input
					type="checkbox"
					name="pushNotifyConsent"
					checked={data.pushConsent}
					disabled={data.isMockAuth}
					class="mt-1"
				/>
				<span>푸시로 납부·학원 안내를 받는 것에 동의합니다.</span>
			</label>
			{#if data.pushConfigured}
				<input type="hidden" id="pushSubscriptionJson" name="pushSubscriptionJson" value="" />
				<button
					type="button"
					onclick={subscribePush}
					disabled={pushBusy || data.isMockAuth}
					class="mt-3 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:bg-gray-200 disabled:text-gray-500"
				>
					{pushBusy ? '구독 중…' : '이 기기에서 푸시 구독하기'}
				</button>
			{/if}
			{#if pushMsg}
				<p class="mt-2 text-xs text-gray-700" role="status">{pushMsg}</p>
			{/if}
			<label for="pushSubscriptionEndpoint" class="mt-3 block text-sm font-medium text-gray-700"
				>푸시 구독 엔드포인트 {data.pushConfigured ? '' : '(개발·스텁, 8자 이상)'}</label
			>
			<input
				id="pushSubscriptionEndpoint"
				name="pushSubscriptionEndpoint"
				type="text"
				value={data.pushSubscriptionEndpoint}
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
				placeholder="https://push.stub/my-device"
				disabled={data.isMockAuth}
			/>
		</div>

		<button
			type="submit"
			disabled={data.isMockAuth}
			class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-300"
		>
			저장
		</button>
	</form>
</section>
