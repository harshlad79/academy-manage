<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string };
	type InquiryStatus = PageData['rows'][number]['status'];

	let { data, form }: { data: PageData; form?: FormFlash } = $props();

	const STATUS_LABEL: Record<InquiryStatus, string> = {
		new: '신규',
		contacted: '연락 완료',
		trial: '체험',
		approved: '정식 승인',
		rejected: '거절'
	};

	function statusBadgeClass(status: InquiryStatus): string {
		switch (status) {
			case 'new':
				return 'bg-blue-100 text-blue-900';
			case 'contacted':
				return 'bg-violet-100 text-violet-900';
			case 'trial':
				return 'bg-amber-100 text-amber-900';
			case 'approved':
				return 'bg-emerald-100 text-emerald-900';
			case 'rejected':
				return 'bg-gray-200 text-gray-800';
		}
	}

	function noticeBannerClass(notice: string | null, message: string): string {
		if (notice?.includes('trial_blocked') || message.includes('체험(trial)')) {
			return 'border-sky-200 bg-sky-50 text-sky-950';
		}
		if (message.includes('실패')) {
			return 'border-amber-200 bg-amber-50 text-amber-950';
		}
		return 'border-emerald-200 bg-emerald-50 text-emerald-950';
	}

	function filterHref(status: InquiryStatus | null): string {
		const base = resolve('/platform/inquiries');
		if (!status) return base;
		return `${base}?status=${encodeURIComponent(status)}`;
	}

	let expandedId = $state<string | null>(null);
</script>

<section class="max-w-6xl">
	<p class="text-sm text-gray-500">
		<a href={resolve('/platform')} class="font-medium text-indigo-600 hover:text-indigo-800"
			>← 플랫폼</a
		>
	</p>
	<h1 class="mt-2 text-2xl font-semibold text-gray-900">학원 등록 문의</h1>
	<p class="mt-2 text-sm text-gray-600">
		공개 폼(<a href={resolve('/academy-inquiry')} class="text-indigo-600 hover:text-indigo-800"
			>/academy-inquiry</a
		>) 접수 건을 검토합니다. 체험 승인 시 원장 <span class="font-medium">academy_admin</span> 이메일
		초대가 생성되며, trial 기간에는 외부 메일이 차단되므로 수락 링크를 복사해 전달하세요.
	</p>

	{#if data.noticeMessage}
		<p
			class="mt-4 rounded-md border px-4 py-3 text-sm {noticeBannerClass(data.notice, data.noticeMessage)}"
		>
			{data.noticeMessage}
		</p>
	{/if}

	{#if form?.error}
		<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
			{form.error}
		</p>
	{/if}

	<nav class="mt-6 flex flex-wrap gap-2 text-sm" aria-label="상태 필터">
		<a
			href={filterHref(null)}
			class="rounded-full px-3 py-1 font-medium {data.statusFilter === null
				? 'bg-indigo-600 text-white'
				: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
		>
			전체
		</a>
		{#each data.statusOptions as status (status)}
			<a
				href={filterHref(status)}
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
					<th class="px-4 py-2 text-left font-medium text-gray-700">학원·담당</th>
					<th class="px-4 py-2 text-left font-medium text-gray-700">연락처</th>
					<th class="px-4 py-2 text-left font-medium text-gray-700">상태</th>
					<th class="px-4 py-2 text-left font-medium text-gray-700">작업</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100">
				{#each data.rows as row (row.id)}
					<tr class={expandedId === row.id ? 'bg-gray-50/80' : ''}>
						<td class="px-4 py-2 align-top text-xs text-gray-600">
							<time datetime={row.createdAt}>{row.createdAt.slice(0, 19).replace('T', ' ')}</time>
						</td>
						<td class="px-4 py-2 align-top">
							<p class="font-medium text-gray-900">{row.academyName}</p>
							<p class="text-xs text-gray-600">{row.contactName} · {row.region}</p>
							<button
								type="button"
								class="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
								onclick={() => (expandedId = expandedId === row.id ? null : row.id)}
							>
								{expandedId === row.id ? '상세 닫기' : '상세 보기'}
							</button>
						</td>
						<td class="px-4 py-2 align-top font-mono text-xs text-gray-800">
							<p>{row.email}</p>
							<p class="mt-0.5 text-gray-600">{row.phone}</p>
						</td>
						<td class="px-4 py-2 align-top">
							<span
								class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {statusBadgeClass(
									row.status
								)}">{STATUS_LABEL[row.status]}</span
							>
							{#if row.trialDays}
								<p class="mt-1 text-xs text-gray-500">체험 {row.trialDays}일</p>
							{/if}
						</td>
						<td class="px-4 py-2 align-top">
							<div class="flex flex-col gap-2">
								{#if row.status === 'new'}
									<form method="POST" action="?/markContacted" class="inline">
										<input type="hidden" name="inquiryId" value={row.id} />
										<button
											type="submit"
											class="text-sm font-medium text-violet-700 hover:text-violet-900"
										>
											연락 완료
										</button>
									</form>
								{/if}
								{#if row.status === 'new' || row.status === 'contacted'}
									<form method="POST" action="?/approveTrial" class="flex flex-wrap items-end gap-2">
										<input type="hidden" name="inquiryId" value={row.id} />
										<label class="sr-only" for="trial-days-{row.id}">체험 일수</label>
										<input
											id="trial-days-{row.id}"
											name="trialDays"
											type="number"
											min="1"
											value="7"
											class="w-14 rounded border border-gray-300 px-2 py-1 text-xs"
										/>
										<button
											type="submit"
											class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
										>
											체험 승인
										</button>
									</form>
									<form method="POST" action="?/reject" class="inline">
										<input type="hidden" name="inquiryId" value={row.id} />
										<button
											type="submit"
											class="text-sm font-medium text-red-600 hover:text-red-800"
										>
											거절
										</button>
									</form>
								{/if}
								{#if row.status === 'trial'}
									<form method="POST" action="?/approveActive" class="inline">
										<input type="hidden" name="inquiryId" value={row.id} />
										<button
											type="submit"
											class="text-sm font-medium text-emerald-700 hover:text-emerald-900"
										>
											정식 승인
										</button>
									</form>
								{/if}
							</div>
						</td>
					</tr>
					{#if expandedId === row.id}
						<tr class="bg-gray-50/60">
							<td colspan="5" class="px-4 py-4">
								<dl class="grid gap-3 text-sm sm:grid-cols-2">
									<div>
										<dt class="text-xs font-medium text-gray-500">문의 ID</dt>
										<dd class="mt-0.5 font-mono text-xs text-gray-800">{row.id}</dd>
									</div>
									<div>
										<dt class="text-xs font-medium text-gray-500">지역/주소</dt>
										<dd class="mt-0.5 text-gray-900">{row.region}</dd>
									</div>
									{#if row.memo}
										<div class="sm:col-span-2">
											<dt class="text-xs font-medium text-gray-500">메모</dt>
											<dd class="mt-0.5 whitespace-pre-wrap text-gray-900">{row.memo}</dd>
										</div>
									{/if}
									{#if row.processedAt}
										<div>
											<dt class="text-xs font-medium text-gray-500">처리 시각 (UTC)</dt>
											<dd class="mt-0.5 text-xs text-gray-700">{row.processedAt}</dd>
										</div>
									{/if}
									{#if row.academyIdHex}
										<div>
											<dt class="text-xs font-medium text-gray-500">연결 학원</dt>
											<dd class="mt-0.5">
												<a
													href={resolve(`/platform/academies/${row.academyIdHex}/members`)}
													class="font-medium text-indigo-600 hover:text-indigo-800"
												>
													멤버·초대 관리 →
												</a>
												<span class="mt-0.5 block font-mono text-[11px] text-gray-500"
													>{row.academyIdHex}</span
												>
											</dd>
										</div>
									{/if}
								</dl>
								{#if row.inviteAcceptUrl}
									<div class="mt-4 rounded-md border border-sky-200 bg-sky-50/80 p-3">
										<p class="text-xs font-medium text-sky-950">원장 초대 수락 링크 (trial 중 메일 차단)</p>
										{#if row.inviteExpiresAt}
											<p class="mt-1 text-[11px] text-sky-900">
												만료(UTC): {row.inviteExpiresAt}
											</p>
										{/if}
										<input
											readonly
											class="mt-2 w-full rounded border border-sky-200 bg-white px-2 py-1 font-mono text-[11px] text-gray-800"
											value={row.inviteAcceptUrl}
										/>
									</div>
								{/if}
							</td>
						</tr>
					{/if}
				{:else}
					<tr>
						<td class="px-4 py-8 text-center text-gray-500" colspan="5">
							{data.statusFilter
								? `${STATUS_LABEL[data.statusFilter]} 상태 문의가 없습니다.`
								: '등록된 문의가 없습니다.'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
