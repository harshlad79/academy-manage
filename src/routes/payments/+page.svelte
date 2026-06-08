<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string; success?: boolean };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();

	function won(n: number) {
		return n.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' });
	}

	function linesForDeposit(dep: PageData['pendingDeposits'][number]) {
		return data.matchingLines.filter((l) => l.amountKrw === dep.amountKrw);
	}
</script>

<section>
	<h1 class="text-2xl font-semibold text-gray-900">수납 · 청구</h1>
	<p class="mt-1 text-sm text-gray-500">
		PRD 기준 청구 단위는 <span class="font-medium text-gray-700">학생 × 수강(Enrollment)</span
		>입니다. 은행 오픈뱅킹 API 연동 전에는
		<span class="font-medium text-gray-700">입금 내역을 수기 등록한 뒤 미납 청구와 매칭</span
		>합니다.
	</p>

	{#if data.dbError}
		<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			{data.dbError}
		</p>
	{:else}
		{#if form?.error}
			<p
				class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
				role="alert"
			>
				{form.error}
			</p>
		{/if}
		{#if form?.success}
			<p
				class="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
			>
				반영했습니다.
			</p>
		{/if}
		{#if data.noticeMessage}
			<p
				class="mt-4 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950"
				role="status"
			>
				{data.noticeMessage}
			</p>
		{/if}

		<form method="GET" class="mt-6 flex flex-wrap items-end gap-3">
			<div>
				<label for="status" class="block text-xs font-medium text-gray-600">상태</label>
				<select
					id="status"
					name="status"
					class="mt-1 min-w-[10rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				>
					<option value="" selected={data.statusFilter === ''}>전체</option>
					<option value="open" selected={data.statusFilter === 'open'}>미납</option>
					<option value="paid" selected={data.statusFilter === 'paid'}>납부완료</option>
				</select>
			</div>
			<button
				type="submit"
				class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
			>
				필터
			</button>
			{#if data.statusFilter}
				<a href={resolve('/payments')} class="text-sm text-indigo-600 hover:text-indigo-800">
					필터 초기화
				</a>
			{/if}
		</form>

		{#if data.openBankingPreview.enabled}
			<div
				class="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
				aria-labelledby="open-banking-stub-heading"
			>
				<h2 id="open-banking-stub-heading" class="text-lg font-semibold text-gray-900">
					오픈뱅킹(스텁) 입금 미리보기
				</h2>
				<p class="mt-1 text-sm text-gray-500">
					서울 달력 기준 <span class="font-medium text-gray-700"
						>{data.openBankingPreview.monthLabel}</span
					> 입금 스텁입니다.
				</p>
				{#if !data.openBankingPreview.configured}
					<p
						class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
						role="status"
					>
						<code class="rounded bg-amber-100/80 px-1 font-mono text-xs"
							>OPEN_BANKING_CLIENT_ID</code
						>를 설정해야 오픈뱅킹 구성이 완료됩니다.
					</p>
				{/if}
				{#if data.openBankingPreview.rows.length === 0}
					<p class="mt-4 text-sm text-gray-600">이번 달 범위에 표시할 스텁 입금이 없습니다.</p>
				{:else}
					<div class="mt-4 overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-3 py-2 font-medium text-gray-700">입금일시</th>
									<th class="px-3 py-2 font-medium text-gray-700">금액</th>
									<th class="px-3 py-2 font-medium text-gray-700">외부ID</th>
									<th class="px-3 py-2 font-medium text-gray-700">메모</th>
									<th class="px-3 py-2 font-medium text-gray-700">등록</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each data.openBankingPreview.rows as row (row.externalId)}
									<tr class="hover:bg-gray-50">
										<td class="px-3 py-2 whitespace-nowrap text-gray-900"
											>{row.depositedAt.slice(0, 19).replace('T', ' ')}</td
										>
										<td class="px-3 py-2 font-medium text-gray-900">{won(row.amountKrw)}</td>
										<td class="px-3 py-2 font-mono text-xs text-gray-700">{row.externalId}</td>
										<td class="max-w-[16rem] px-3 py-2 text-gray-600">{row.memo ?? '—'}</td>
										<td class="px-3 py-2">
											<form method="POST" action="?/importOpenBankingStubDeposit" class="inline">
												<input type="hidden" name="externalId" value={row.externalId} />
												<input type="hidden" name="amountKrw" value={String(row.amountKrw)} />
												<input type="hidden" name="depositedAt" value={row.depositedAt} />
												<button
													type="submit"
													class="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-800 shadow-sm hover:bg-slate-50"
												>
													미매칭 입금으로 등록
												</button>
											</form>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{:else}
			<p class="mt-6 text-sm text-gray-500">
				스텁은 <code class="rounded bg-gray-100 px-1 font-mono text-xs text-gray-800"
					>OPEN_BANKING_ENABLED=true</code
				> 일 때 표시됩니다.
			</p>
		{/if}

		{#if data.enrollments.length === 0}
			<p class="mt-6 text-sm text-gray-600">
				청구를 만들 수강이 없습니다.
				<a class="text-indigo-600 hover:text-indigo-800" href={resolve('/enrollments')}>수강 관리</a
				>에서 먼저 등록하세요.
			</p>
		{:else}
			<form
				method="POST"
				action="?/create"
				class="mt-6 flex flex-wrap items-end gap-3 border-t border-gray-200 pt-6"
			>
				<div>
					<label for="enrollmentId" class="block text-xs font-medium text-gray-600">수강</label>
					<select
						id="enrollmentId"
						name="enrollmentId"
						required
						class="mt-1 max-w-[24rem] min-w-[16rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					>
						<option value="" disabled selected>선택</option>
						{#each data.enrollments as e (e.id)}
							<option value={e.id}>{e.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="amountKrw" class="block text-xs font-medium text-gray-600">금액(원)</label>
					<input
						id="amountKrw"
						name="amountKrw"
						type="text"
						inputmode="numeric"
						required
						placeholder="120000"
						class="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					/>
				</div>
				<div>
					<label for="dueDate" class="block text-xs font-medium text-gray-600">납부기한</label>
					<input
						id="dueDate"
						name="dueDate"
						type="date"
						required
						value={data.defaultDueDate}
						class="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					/>
				</div>
				<div>
					<label for="description" class="block text-xs font-medium text-gray-600">설명</label>
					<input
						id="description"
						name="description"
						type="text"
						maxlength="500"
						placeholder="기본: 수강료"
						class="mt-1 min-w-[12rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					/>
				</div>
				<button
					type="submit"
					class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
				>
					청구 추가
				</button>
			</form>
		{/if}

		<form
			method="POST"
			action="?/registerInboundDeposit"
			class="mt-8 flex flex-wrap items-end gap-3 border-t border-gray-200 pt-6"
		>
			<p class="w-full text-sm font-medium text-gray-900">미매칭 입금 등록(MVP)</p>
			<p class="w-full text-xs text-gray-500">
				오픈뱅킹 피드를 받기 전까지 실제 계좌 입금을 여기에 수기로 적습니다. 금액이 같은 미납 청구만
				매칭할 수 있습니다.
			</p>
			<div>
				<label for="depAmountKrw" class="block text-xs font-medium text-gray-600">금액(원)</label>
				<input
					id="depAmountKrw"
					name="amountKrw"
					type="text"
					inputmode="numeric"
					required
					placeholder="120000"
					class="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label for="depositedAt" class="block text-xs font-medium text-gray-600">입금일</label>
				<input
					id="depositedAt"
					name="depositedAt"
					type="date"
					required
					value={data.defaultDueDate}
					class="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label for="externalRef" class="block text-xs font-medium text-gray-600"
					>거래 참조(선택)</label
				>
				<input
					id="externalRef"
					name="externalRef"
					type="text"
					maxlength="128"
					placeholder="은행 거래번호 등"
					class="mt-1 min-w-[10rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label for="depMemo" class="block text-xs font-medium text-gray-600">입금 표시(선택)</label>
				<input
					id="depMemo"
					name="memo"
					type="text"
					maxlength="200"
					placeholder="입금자 표시 이름"
					class="mt-1 min-w-[12rem] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				/>
			</div>
			<button
				type="submit"
				class="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
			>
				입금 줄 추가
			</button>
		</form>

		{#if data.pendingDeposits.length > 0}
			<div class="mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<h2 class="text-lg font-semibold text-gray-900">미매칭 입금</h2>
				<p class="mt-1 text-sm text-gray-500">
					금액이 일치하는 미납 청구가 있어야 「청구 매칭」이 가능합니다. 매칭 시 수납 방식은
					<code class="rounded bg-gray-100 px-1 text-xs text-gray-800">은행 거래(bank_import)</code> 로
					기록되고 입금 표시 내용은 수납 비고에 포함됩니다.
				</p>
				<div class="mt-4 space-y-4">
					{#each data.pendingDeposits as dep (dep.id)}
						{@const cand = linesForDeposit(dep)}
						<div class="rounded-md border border-amber-100 bg-amber-50/80 p-3 text-sm">
							<p class="font-medium text-gray-900">
								{won(dep.amountKrw)}
								<span class="font-normal text-gray-600">&nbsp;·&nbsp;</span>
								{dep.depositedAt.slice(0, 10)}
								{#if dep.externalRef}<span class="font-normal text-gray-600"
										>&nbsp;·&nbsp;참조 {dep.externalRef}</span
									>{/if}
								{#if dep.memo}<span class="font-normal text-gray-600"
										>&nbsp;·&nbsp;표시 {dep.memo}</span
									>{/if}
							</p>
							{#if cand.length === 0}
								<p class="mt-2 text-amber-900">동일 금액의 미납 청구가 없습니다.</p>
							{:else}
								<form
									method="POST"
									action="?/matchDeposit"
									class="mt-3 flex flex-wrap items-center gap-2"
								>
									<input type="hidden" name="depositId" value={dep.id} />
									<label for={`match-${dep.id}`} class="sr-only">매칭할 청구</label>
									<select
										id={`match-${dep.id}`}
										name="invoiceLineId"
										required
										class="max-w-full min-w-[14rem] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
									>
										{#each cand as line (line.id)}
											<option value={line.id}>
												{line.studentName}
												&nbsp;·&nbsp;
												{line.courseName}
												&nbsp;·&nbsp;
												{line.description}
												&nbsp;·&nbsp;기한&nbsp;{line.dueDate}
											</option>
										{/each}
									</select>
									<button
										type="submit"
										class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
									>
										청구 매칭
									</button>
								</form>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
			<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 font-medium text-gray-700">학생</th>
						<th class="px-4 py-3 font-medium text-gray-700">클래스</th>
						<th class="px-4 py-3 font-medium text-gray-700">설명</th>
						<th class="px-4 py-3 font-medium text-gray-700">금액</th>
						<th class="px-4 py-3 font-medium text-gray-700">기한</th>
						<th class="px-4 py-3 font-medium text-gray-700">상태</th>
						<th class="min-w-[11rem] px-4 py-3 font-medium text-gray-700">작업</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each data.rows as row (row.id)}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-3 text-gray-900">{row.studentName}</td>
							<td class="px-4 py-3 text-gray-600">{row.courseName}</td>
							<td class="px-4 py-3 text-gray-600">{row.description}</td>
							<td class="px-4 py-3 font-medium text-gray-900">{won(row.amountKrw)}</td>
							<td class="px-4 py-3 text-gray-600">{row.dueDate}</td>
							<td class="px-4 py-3">
								{#if row.status === 'open'}
									<span
										class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
										>미납</span
									>
								{:else}
									<span
										class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900"
										>납부완료</span
									>
									{#if row.paidAt}
										<div class="mt-1 text-xs text-gray-500">{row.paidAt.slice(0, 10)}</div>
									{/if}
								{/if}
							</td>
							<td class="px-4 py-3">
								<div class="flex flex-wrap items-center gap-2">
									{#if row.status === 'open'}
										<form method="POST" action="?/markPaid">
											<input type="hidden" name="id" value={row.id} />
											<button
												type="submit"
												class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
											>
												납부 처리
											</button>
										</form>
										<form method="POST" action="?/notifyPaymentDue">
											<input type="hidden" name="id" value={row.id} />
											<button
												type="submit"
												class="text-sm font-medium text-violet-700 hover:text-violet-900"
												title={data.parentNotifySmsEnabled
													? '연결·동의한 학부모에게 납부 안내 SMS(스텁) 발송'
													: 'PARENT_NOTIFY_SMS_ENABLED=true 로 스텁 발송 테스트'}
											>
												SMS
											</button>
										</form>
										<form method="POST" action="?/notifyPaymentDueEmail">
											<input type="hidden" name="id" value={row.id} />
											<button
												type="submit"
												class="text-sm font-medium text-sky-700 hover:text-sky-900"
												title={data.parentNotifyEmailEnabled
													? '이메일 동의 학부모에게 발송(SMTP 있으면 실발송)'
													: 'PARENT_NOTIFY_EMAIL_ENABLED=true'}
											>
												이메일
											</button>
										</form>
										<form method="POST" action="?/notifyPaymentDuePush">
											<input type="hidden" name="id" value={row.id} />
											<button
												type="submit"
												class="text-sm font-medium text-teal-700 hover:text-teal-900"
												title={data.parentNotifyPushEnabled
													? '푸시 동의·구독 ID 학부모에게 스텁 발송'
													: 'PARENT_NOTIFY_PUSH_ENABLED=true'}
											>
												푸시
											</button>
										</form>
										<form
											method="POST"
											action="?/delete"
											use:enhance={({ cancel }) => {
												if (!confirm('미납 청구를 삭제할까요?')) cancel();
											}}
										>
											<input type="hidden" name="id" value={row.id} />
											<button
												type="submit"
												class="text-sm font-medium text-red-600 hover:text-red-800"
											>
												삭제
											</button>
										</form>
									{:else}
										<span class="text-xs text-gray-400">—</span>
									{/if}
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="px-4 py-8 text-center text-gray-500">
								{#if data.statusFilter}
									조건에 맞는 청구가 없습니다.
								{:else}
									등록된 청구가 없습니다.
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="mt-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<h2 class="text-lg font-semibold text-gray-900">최근 수납 이력</h2>
			<p class="mt-1 text-sm text-gray-500">
				미납 청구의 「납부 처리」 또는 입금의 「청구 매칭」 시 기록입니다. 최대 30건.
			</p>
			{#if data.recentPayments.length === 0}
				<p class="mt-4 text-sm text-gray-600">등록된 수납 이력이 없습니다.</p>
			{:else}
				<div class="mt-4 overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200 text-left text-sm">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-3 py-2 font-medium text-gray-700">일시</th>
								<th class="px-3 py-2 font-medium text-gray-700">학생</th>
								<th class="px-3 py-2 font-medium text-gray-700">클래스</th>
								<th class="px-3 py-2 font-medium text-gray-700">청구 설명</th>
								<th class="px-3 py-2 font-medium text-gray-700">금액</th>
								<th class="px-3 py-2 font-medium text-gray-700">방식</th>
								<th class="px-3 py-2 font-medium text-gray-700">거래 참조</th>
								<th class="px-3 py-2 font-medium text-gray-700">기록 사용자</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each data.recentPayments as pmt (pmt.id)}
								<tr class="hover:bg-gray-50">
									<td class="px-3 py-2 text-gray-900"
										>{pmt.paidAt.slice(0, 16).replace('T', ' ')}</td
									>
									<td class="px-3 py-2 text-gray-900">{pmt.studentName}</td>
									<td class="px-3 py-2 text-gray-600">{pmt.courseName}</td>
									<td class="px-3 py-2 text-gray-600">{pmt.description}</td>
									<td class="px-3 py-2 font-medium text-gray-900">{won(pmt.amountKrw)}</td>
									<td class="px-3 py-2 text-gray-600">
										{#if pmt.method === 'manual'}수기{:else}은행 거래{/if}
									</td>
									<td
										class="max-w-[10rem] truncate px-3 py-2 font-mono text-xs text-gray-500"
										title={pmt.externalRef ?? ''}>{pmt.externalRef ?? '—'}</td
									>
									<td class="px-3 py-2 font-mono text-xs text-gray-500">{pmt.recordedByUserId}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</section>
