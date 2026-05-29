<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string; success?: boolean };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();

	const STATUS_LABEL: Record<PageData['statusOptions'][number], string> = {
		new: '신규',
		contacted: '연락 완료',
		waitlisted: '대기',
		converted: '전환',
		closed: '종료'
	};

	const SOURCE_LABEL: Record<NonNullable<PageData['lead']>['source'], string> = {
		web: '웹 신청',
		staff: '직접 입력'
	};

	function formatDateTime(iso: string | null): string {
		if (!iso) return '—';
		return iso.slice(0, 19).replace('T', ' ');
	}
</script>

<section class="max-w-2xl">
	<h1 class="text-2xl font-semibold text-gray-900">상담·대기 상세</h1>
	<p class="mt-1 text-sm text-gray-600">
		학원 스코프 내에서만 조회·수정됩니다. 상태 변경과 학생 전환은 이 화면에서 수행합니다.
	</p>

	{#if data.dbError}
		<p
			class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
			role="alert"
		>
			{data.dbError}
		</p>
	{:else}
		{#if form?.error}
			<p
				class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
				role="alert"
			>
				{form.error}
			</p>
		{:else if form?.success}
			<p
				class="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
				role="status"
			>
				저장했습니다.
			</p>
		{/if}

		{#if data.lead}
			<div class="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p class="text-sm text-gray-500">학생</p>
						<p class="mt-0.5 text-lg font-semibold text-gray-900">
							{data.lead.studentName}
						</p>
						<p class="text-sm text-gray-600">{data.lead.guardianName}</p>
						<p class="mt-1 font-mono text-xs text-gray-800">{data.lead.phone}</p>
					</div>
					<div class="text-right">
						<p class="text-xs text-gray-500">상태</p>
						<p class="mt-1">
							<span
								class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium
								{data.lead.status === 'new'
									? 'bg-blue-100 text-blue-900'
									: data.lead.status === 'contacted'
										? 'bg-violet-100 text-violet-900'
										: data.lead.status === 'waitlisted'
											? 'bg-amber-100 text-amber-900'
											: data.lead.status === 'converted'
												? 'bg-emerald-100 text-emerald-900'
												: 'bg-gray-200 text-gray-800'}">{STATUS_LABEL[data.lead.status]}</span
							>
						</p>
						{#if data.lead.convertedAt}
							<p class="mt-1 text-[11px] text-gray-500">
								전환 {formatDateTime(data.lead.convertedAt)}
							</p>
						{/if}
						{#if data.lead.status === 'converted'}
							{#if data.lead.enrolledAt}
								<p class="mt-1 text-[11px] text-emerald-800">
									수강 등록 · {formatDateTime(data.lead.enrolledAt)}
								</p>
							{:else}
								<p
									class="mt-2 inline-flex rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900"
								>
									등록됨·수강 미배정
								</p>
							{/if}
						{/if}
					</div>
				</div>

				<div class="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-700">
					<p>
						<span class="font-medium">출처:</span>
						<span class="ml-1">{SOURCE_LABEL[data.lead.source]}</span>
					</p>
					<p class="mt-1">
						<span class="font-medium">접수:</span>
						<span class="ml-1">
							<time datetime={data.lead.createdAt}>{formatDateTime(data.lead.createdAt)}</time>
						</span>
					</p>
					{#if data.lead.memo}
						<p class="mt-2 text-sm whitespace-pre-line text-gray-700">
							<span class="font-medium">메모:</span>
							<br />
							{data.lead.memo}
						</p>
					{/if}
					{#if data.lead.studentIdHex}
						<p class="mt-3 text-sm">
							<span class="font-medium text-gray-800">연결된 학생:</span>
							<a
								href={resolve(`/students/${data.lead.studentIdHex}/edit`)}
								class="ml-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
							>
								학생 편집 →
							</a>
						</p>
					{/if}
				</div>
			</div>

			<div class="mt-6 space-y-6">
				<form
					method="POST"
					action="?/updateStatus"
					class="flex flex-wrap items-end gap-3"
					use:enhance
				>
					<div>
						<label for="status" class="block text-xs font-medium text-gray-600">상태</label>
						<select
							id="status"
							name="status"
							class="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
						>
							{#each data.statusOptions as s (s)}
								<option value={s} selected={data.lead.status === s}>{STATUS_LABEL[s]}</option>
							{/each}
						</select>
					</div>
					<div class="flex-1">
						<label for="closeReason" class="block text-xs font-medium text-gray-600">
							종료 사유 (선택)
						</label>
						<input
							id="closeReason"
							name="closeReason"
							maxlength="200"
							class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
							placeholder="종료 시에만 사용됩니다."
						/>
					</div>
					<button
						type="submit"
						class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
					>
						상태 저장
					</button>
				</form>

				{#if data.lead.status !== 'converted' && data.lead.status !== 'closed'}
					<form
						method="POST"
						action="?/convertLead"
						class="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"
					>
						<div>
							<p class="text-sm font-medium text-emerald-900">학생으로 전환</p>
							<p class="mt-0.5 text-xs text-emerald-900/80">
								학생 문서를 생성하고 이 리드를 학생과 연결합니다. 완료 후 학생 편집 화면으로
								이동합니다.
							</p>
						</div>
						<button
							type="submit"
							class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
						>
							학생 전환
						</button>
					</form>
				{/if}
			</div>
		{/if}

		<div class="mt-8">
			<a href={resolve('/leads')} class="text-sm font-medium text-gray-700 hover:text-gray-900">
				← 상담·대기 목록으로
			</a>
		</div>
	{/if}
</section>
