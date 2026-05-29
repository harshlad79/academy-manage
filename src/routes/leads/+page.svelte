<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string; success?: boolean; studentId?: string };
	type LeadStatus = PageData['statusOptions'][number];
	type LeadRow = PageData['leads'][number];

	let { data, form }: { data: PageData; form?: FormFlash } = $props();

	const STATUS_LABEL: Record<LeadStatus, string> = {
		new: '신규',
		contacted: '연락 완료',
		waitlisted: '대기',
		converted: '전환',
		closed: '종료'
	};

	const SOURCE_LABEL: Record<LeadRow['source'], string> = {
		web: '웹 신청',
		staff: '직접 입력'
	};

	function statusBadgeClass(status: LeadStatus): string {
		switch (status) {
			case 'new':
				return 'bg-blue-100 text-blue-900';
			case 'contacted':
				return 'bg-violet-100 text-violet-900';
			case 'waitlisted':
				return 'bg-amber-100 text-amber-900';
			case 'converted':
				return 'bg-emerald-100 text-emerald-900';
			case 'closed':
				return 'bg-gray-200 text-gray-800';
		}
	}

	function formatDateTime(iso: string | null): string {
		if (!iso) return '—';
		return iso.slice(0, 19).replace('T', ' ');
	}

	let copyNotice = $state<string | null>(null);

	async function copyApplyLink() {
		if (!data.applyUrl) return;
		copyNotice = null;
		try {
			await navigator.clipboard.writeText(data.applyUrl);
			copyNotice = '공개 신청 링크를 복사했습니다.';
		} catch {
			copyNotice = '복사에 실패했습니다. 아래 URL을 직접 복사하세요.';
		}
	}
</script>

<section class="max-w-6xl">
	<h1 class="text-2xl font-semibold text-gray-900">상담·대기</h1>
	<p class="mt-2 text-sm text-gray-600">
		학부모 공개 신청(<code class="font-mono text-[11px]">/apply?a=…</code>)과 행정 직접 입력 건을 상태별로
		관리합니다. 전환 시 학생 문서가 생성되며, 첫 수강 등록 시 수강 등록 일시가 채워집니다.
	</p>

	{#if data.dbError}
		<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			{data.dbError}
		</p>
	{:else}
		{#if form?.error}
			<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
				{form.error}
			</p>
		{/if}
		{#if form?.success && form?.studentId}
			<p class="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
				학생으로 전환했습니다.
				<a
					class="font-medium text-indigo-600 hover:text-indigo-800"
					href={resolve(`/students/${form.studentId}/edit`)}
				>
					학생 편집 →
				</a>
			</p>
		{:else if form?.success}
			<p class="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
				저장했습니다.
			</p>
		{/if}

		{#if data.applyUrl}
			<div class="mt-6 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
				<p class="text-sm font-medium text-indigo-950">공개 신청 링크</p>
				<p class="mt-1 text-xs text-indigo-900">
					학원 ID: <span class="font-mono">{data.academyIdHex}</span>
				</p>
				<div class="mt-3 flex flex-wrap items-center gap-2">
					<input
						readonly
						class="min-w-0 flex-1 rounded border border-indigo-200 bg-white px-2 py-1.5 font-mono text-[11px] text-gray-800"
						value={data.applyUrl}
						aria-label="공개 신청 URL"
					/>
					<button
						type="button"
						class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
						onclick={copyApplyLink}
					>
						링크 복사
					</button>
				</div>
				{#if copyNotice}
					<p class="mt-2 text-xs text-indigo-900">{copyNotice}</p>
				{/if}
			</div>
		{/if}

		<form
			method="POST"
			action="?/createStaffLead"
			class="mt-6 flex flex-wrap items-end gap-3 border-t border-gray-200 pt-6"
			use:enhance
		>
			<div>
				<label for="lead-student-name" class="block text-xs font-medium text-gray-600">학생 이름</label>
				<input
					id="lead-student-name"
					name="studentName"
					required
					maxlength="120"
					class="mt-1 min-w-[8rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label for="lead-guardian-name" class="block text-xs font-medium text-gray-600">보호자명</label>
				<input
					id="lead-guardian-name"
					name="guardianName"
					required
					maxlength="120"
					class="mt-1 min-w-[8rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label for="lead-phone" class="block text-xs font-medium text-gray-600">휴대번호</label>
				<input
					id="lead-phone"
					name="phone"
					required
					inputmode="tel"
					autocomplete="tel"
					class="mt-1 min-w-[10rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					placeholder="01012345678"
				/>
			</div>
			<div>
				<label for="lead-memo" class="block text-xs font-medium text-gray-600">메모</label>
				<input
					id="lead-memo"
					name="memo"
					maxlength="500"
					class="mt-1 min-w-[12rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					placeholder="희망 수업 등"
				/>
			</div>
			<button
				type="submit"
				class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
			>
				직접 등록
			</button>
		</form>

		<nav class="mt-8 flex flex-wrap gap-2 text-sm" aria-label="상태 필터">
			<a
				href={resolve('/leads')}
				class="rounded-full px-3 py-1 font-medium {data.statusFilter === null
					? 'bg-indigo-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
			>
				전체
			</a>
			{#each data.statusOptions as status (status)}
				<a
					href={resolve(`/leads?status=${encodeURIComponent(status)}`)}
					class="rounded-full px-3 py-1 font-medium {data.statusFilter === status
						? 'bg-indigo-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					{STATUS_LABEL[status]}
				</a>
			{/each}
		</nav>

		<div class="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
			<table class="min-w-full divide-y divide-gray-200 text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-2 text-left font-medium text-gray-700">접수</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">학생·보호자</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">연락처</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">출처</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">상태</th>
						{#if data.statusFilter === 'converted'}
							<th class="px-4 py-2 text-left font-medium text-gray-700">수강 등록</th>
						{/if}
						<th class="px-4 py-2 text-left font-medium text-gray-700">작업</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each data.leads as row (row.id)}
						<tr>
							<td class="px-4 py-2 align-top text-xs text-gray-600">
								<time datetime={row.createdAt}>{formatDateTime(row.createdAt)}</time>
							</td>
							<td class="px-4 py-2 align-top">
								<p class="font-medium text-gray-900">{row.studentName}</p>
								<p class="text-xs text-gray-600">{row.guardianName}</p>
								{#if row.memo}
									<p class="mt-1 text-xs text-gray-500">{row.memo}</p>
								{/if}
							</td>
							<td class="px-4 py-2 align-top font-mono text-xs text-gray-800">{row.phone}</td>
							<td class="px-4 py-2 align-top text-xs text-gray-700">{SOURCE_LABEL[row.source]}</td>
							<td class="px-4 py-2 align-top">
								<span
									class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {statusBadgeClass(
										row.status
									)}">{STATUS_LABEL[row.status]}</span
								>
								{#if row.convertedAt}
									<p class="mt-1 text-[11px] text-gray-500">
										전환 {formatDateTime(row.convertedAt)}
									</p>
								{/if}
							</td>
							{#if data.statusFilter === 'converted'}
								<td class="px-4 py-2 align-top text-xs">
									{#if row.enrolledAt}
										<span class="text-emerald-800">수강 등록 · {formatDateTime(row.enrolledAt)}</span>
									{:else}
										<span class="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
											등록됨·수강 미배정
										</span>
									{/if}
								</td>
							{/if}
							<td class="px-4 py-2 align-top">
								<div class="flex flex-col gap-2">
									{#if row.status !== 'converted' && row.status !== 'closed'}
										<form method="POST" action="?/convertLead" class="inline" use:enhance>
											<input type="hidden" name="leadId" value={row.id} />
											<button
												type="submit"
												class="text-sm font-medium text-emerald-700 hover:text-emerald-900"
											>
												학생 전환
											</button>
										</form>
									{/if}
									{#if row.studentIdHex}
										<a
											href={resolve(`/students/${row.studentIdHex}/edit`)}
											class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
										>
											학생 편집 →
										</a>
									{/if}
									<form
										method="POST"
										action="?/updateStatus"
										class="flex flex-wrap items-end gap-1"
										use:enhance
									>
										<input type="hidden" name="leadId" value={row.id} />
										<label class="sr-only" for="status-{row.id}">상태 변경</label>
										<select
											id="status-{row.id}"
											name="status"
											class="rounded border border-gray-300 px-2 py-1 text-xs"
										>
											{#each data.statusOptions as s (s)}
												<option value={s} selected={row.status === s}>{STATUS_LABEL[s]}</option>
											{/each}
										</select>
										<button
											type="submit"
											class="text-xs font-medium text-gray-700 hover:text-gray-900"
										>
											상태 저장
										</button>
									</form>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td
								class="px-4 py-8 text-center text-gray-500"
								colspan={data.statusFilter === 'converted' ? 7 : 6}
							>
								{data.statusFilter
									? `${STATUS_LABEL[data.statusFilter]} 상태 건이 없습니다.`
									: '등록된 상담·대기 건이 없습니다.'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
