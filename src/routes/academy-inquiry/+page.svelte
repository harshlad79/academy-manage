<script lang="ts">
	import type { ActionData } from './$types';

	type FormState = ActionData & {
		error?: string;
		values?: {
			academyName: string;
			contactName: string;
			phone: string;
			email: string;
			region: string;
			memo?: string;
		};
	};

	let { form }: { form?: FormState } = $props();

	const v = $derived(form?.values);
</script>

<section class="mx-auto max-w-lg px-4 py-16">
	<h1 class="text-xl font-semibold text-gray-900">학원 등록 문의</h1>
	<p class="mt-2 text-sm text-gray-600">
		서비스 도입을 원하시면 아래 정보를 남겨 주세요. 플랫폼 담당자가 확인 후 연락드립니다.
	</p>

	{#if form?.error}
		<p
			class="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
			role="alert"
		>
			{form.error}
		</p>
	{/if}

	<form method="POST" class="mt-8 space-y-5">
		<div>
			<label for="academyName" class="block text-xs font-medium text-gray-600">학원명</label>
			<input
				id="academyName"
				name="academyName"
				type="text"
				required
				autocomplete="organization"
				class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
				value={v?.academyName ?? ''}
			/>
		</div>

		<div>
			<label for="contactName" class="block text-xs font-medium text-gray-600">원장/담당자명</label>
			<input
				id="contactName"
				name="contactName"
				type="text"
				required
				autocomplete="name"
				class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
				value={v?.contactName ?? ''}
			/>
		</div>

		<div>
			<label for="phone" class="block text-xs font-medium text-gray-600">휴대번호</label>
			<input
				id="phone"
				name="phone"
				type="tel"
				required
				inputmode="tel"
				autocomplete="tel"
				placeholder="01012345678"
				class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
				value={v?.phone ?? ''}
			/>
			<p class="mt-1 text-xs text-gray-500">숫자만 입력 (예: 01012345678)</p>
		</div>

		<div>
			<label for="email" class="block text-xs font-medium text-gray-600">이메일</label>
			<input
				id="email"
				name="email"
				type="email"
				required
				autocomplete="email"
				class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
				value={v?.email ?? ''}
			/>
		</div>

		<div>
			<label for="region" class="block text-xs font-medium text-gray-600">지역/주소</label>
			<input
				id="region"
				name="region"
				type="text"
				required
				autocomplete="street-address"
				class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
				value={v?.region ?? ''}
			/>
		</div>

		<div>
			<label for="memo" class="block text-xs font-medium text-gray-600"
				>문의 메모 <span class="font-normal text-gray-400">(선택)</span></label
			>
			<textarea
				id="memo"
				name="memo"
				rows="4"
				class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
				>{v?.memo ?? ''}</textarea
			>
		</div>

		<button
			type="submit"
			class="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
		>
			문의 접수
		</button>
	</form>
</section>
