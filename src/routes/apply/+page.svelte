<script lang="ts">
	import type { ActionData } from './$types';

	type FormState = ActionData & {
		error?: string;
		academyId?: string;
		academyName?: string;
		values?: {
			studentName: string;
			guardianName: string;
			phone: string;
			memo?: string;
		};
	};

	let { data, form }: { data: { academyId: string; academyName: string }; form?: FormState } =
		$props();

	const academyId = $derived(form?.academyId ?? data.academyId);
	const academyName = $derived(form?.academyName ?? data.academyName);
	const v = $derived(form?.values);
</script>

<section class="mx-auto max-w-lg px-4 py-16">
	<h1 class="text-xl font-semibold text-gray-900">수강 신청</h1>
	<p class="mt-2 text-sm text-gray-600">
		<span class="font-medium text-gray-800">{academyName}</span> 수강·상담 신청입니다. 아래 정보를
		남겨 주시면 학원에서 연락드립니다.
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
		<input type="hidden" name="academyId" value={academyId} />

		<div>
			<label for="studentName" class="block text-xs font-medium text-gray-600">학생(자녀) 이름</label>
			<input
				id="studentName"
				name="studentName"
				type="text"
				required
				autocomplete="name"
				class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
				value={v?.studentName ?? ''}
			/>
		</div>

		<div>
			<label for="guardianName" class="block text-xs font-medium text-gray-600">보호자명</label>
			<input
				id="guardianName"
				name="guardianName"
				type="text"
				required
				autocomplete="name"
				class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
				value={v?.guardianName ?? ''}
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
			<label for="memo" class="block text-xs font-medium text-gray-600"
				>희망 수업/메모 <span class="font-normal text-gray-400">(선택)</span></label
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
			신청 접수
		</button>
	</form>
</section>
