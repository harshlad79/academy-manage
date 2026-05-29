<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();

	function noticeBannerClass(notice: string | null, message: string): string {
		if (notice?.includes('trial_blocked') || message.includes('체험(trial)')) {
			return 'border-sky-200 bg-sky-50 text-sky-950';
		}
		if (message.includes('실패')) {
			return 'border-amber-200 bg-amber-50 text-amber-950';
		}
		return 'border-emerald-200 bg-emerald-50 text-emerald-950';
	}

	function inviteDeliveryStatusLabel(inv: PageData['inviteRows'][number]): string {
		if (inv.channel === 'sms') {
			if (inv.lastSmsSentAt) {
				return `SMS 발송됨 · ${inv.lastSmsSentAt.slice(0, 19).replace('T', ' ')} UTC`;
			}
			if (inv.lastSmsError) {
				return `SMS 실패 · ${inv.lastSmsError}`;
			}
			return 'SMS 미발송';
		}
		if (inv.lastEmailSentAt) {
			return `메일 발송됨 · ${inv.lastEmailSentAt.slice(0, 19).replace('T', ' ')} UTC`;
		}
		if (inv.lastEmailError) {
			return `메일 실패 · ${inv.lastEmailError}`;
		}
		return '메일 미발송';
	}

	let inviteRole = $state('office');
</script>

<section class="max-w-5xl">
	<h1 class="text-2xl font-semibold text-gray-900">학원 설정 — 멤버·초대</h1>
	<p class="mt-1 text-sm text-gray-600">
		{data.academyName} · 상태 <span class="font-medium">{data.academyStatus}</span>
	</p>

	{#if data.noticeMessage}
		<p
			class="mt-4 rounded-md border px-4 py-3 text-sm {noticeBannerClass(
				data.notice,
				data.noticeMessage
			)}"
		>
			{data.noticeMessage}
		</p>
	{/if}

	{#if form?.error}
		<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
			{form.error}
		</p>
	{/if}

	<form
		method="POST"
		action="?/createInvite"
		class="mt-6 max-w-xl rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 shadow-sm"
	>
		<h2 class="text-sm font-semibold text-gray-900">멤버십 초대</h2>
		<p class="mt-1 text-xs text-gray-500">
			행정·강사는 이메일, 학부모는 SMS(또는 링크 복사). 원장(academy_admin) 초대는 플랫폼 문의 승인
			경로를 사용합니다.
		</p>
		<div class="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
			{#if inviteRole === 'parent'}
				<div class="min-w-[12rem] flex-1">
					<label for="inv-phone" class="block text-xs font-medium text-gray-600">휴대번호</label>
					<input
						id="inv-phone"
						name="phone"
						type="tel"
						autocomplete="tel"
						required
						class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
						placeholder="01012345678"
					/>
				</div>
			{:else}
				<div class="min-w-[12rem] flex-1">
					<label for="inv-email" class="block text-xs font-medium text-gray-600">이메일</label>
					<input
						id="inv-email"
						name="email"
						type="email"
						autocomplete="email"
						required
						class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
						placeholder="staff@example.com"
					/>
				</div>
			{/if}
			<div>
				<label for="inv-role" class="block text-xs font-medium text-gray-600">역할</label>
				<select
					id="inv-role"
					name="role"
					class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm sm:w-40"
					required
					bind:value={inviteRole}
				>
					{#each data.inviteRoles as r (r)}
						<option value={r}>{r}</option>
					{/each}
				</select>
			</div>
			<div class={inviteRole === 'teacher' ? '' : 'opacity-60'}>
				<label for="inv-teacher" class="block text-xs font-medium text-gray-600"
					>강사 프로필 (teacher)</label
				>
				<select
					id="inv-teacher"
					name="linkedTeacherId"
					class="mt-1 w-full max-w-xs rounded border border-gray-300 px-2 py-1.5 text-sm"
					disabled={inviteRole !== 'teacher'}
				>
					<option value="">나중에 연결</option>
					{#each data.teacherOptions as opt (opt.id)}
						<option value={opt.id}
							>{opt.name}{#if opt.subject}&nbsp;· {opt.subject}{/if}</option
						>
					{/each}
				</select>
			</div>
			<button
				type="submit"
				class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
			>
				초대 생성
			</button>
		</div>
	</form>

	{#if data.inviteRows.length > 0}
		<div class="mt-6 overflow-x-auto rounded-lg border border-indigo-100 bg-white shadow-sm">
			<table class="min-w-full divide-y divide-gray-200 text-sm">
				<thead class="bg-indigo-50/80">
					<tr>
						<th class="px-4 py-2 text-left font-medium text-gray-700">연락처</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">역할</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">만료(UTC)</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">발송</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">수락 링크</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">작업</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each data.inviteRows as inv (inv.id)}
						<tr>
							<td class="px-4 py-2 font-mono text-xs text-gray-900">
								{inv.phone ?? inv.email ?? '—'}
							</td>
							<td class="px-4 py-2 text-gray-800">{inv.role}</td>
							<td class="px-4 py-2 text-xs text-gray-600">{inv.expiresAt}</td>
							<td class="max-w-[10rem] px-4 py-2 text-xs text-gray-700">
								<span
									class={inv.lastEmailError || inv.lastSmsError
										? 'text-amber-800'
										: inv.lastEmailSentAt || inv.lastSmsSentAt
											? 'text-emerald-800'
											: 'text-gray-500'}>{inviteDeliveryStatusLabel(inv)}</span
								>
							</td>
							<td class="max-w-xs px-4 py-2 align-top">
								<input
									readonly
									class="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-800"
									value={`${data.inviteAcceptOrigin}${resolve('/invite/accept')}?token=${encodeURIComponent(inv.token)}`}
								/>
							</td>
							<td class="px-4 py-2">
								<form method="POST" action="?/resendInvite" class="inline">
									<input type="hidden" name="inviteId" value={inv.id} />
									<button
										type="submit"
										class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
									>
										{inv.channel === 'sms' ? 'SMS 재발송' : '메일 재발송'}
									</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<div class="mt-8 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
		<h2 class="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-900">
			현재 멤버
		</h2>
		<table class="min-w-full divide-y divide-gray-200 text-sm">
			<thead class="bg-gray-50">
				<tr>
					<th class="px-4 py-2 text-left font-medium text-gray-700">사용자 ID</th>
					<th class="px-4 py-2 text-left font-medium text-gray-700">역할</th>
					<th class="px-4 py-2 text-left font-medium text-gray-700">강사 연결</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100">
				{#each data.rows as row (row.userId + row.role)}
					<tr>
						<td class="px-4 py-2 font-mono text-xs text-gray-900">{row.userId}</td>
						<td class="px-4 py-2 text-gray-800">{row.role}</td>
						<td class="px-4 py-2 text-xs text-gray-700">
							{row.linkedTeacherName ?? row.linkedTeacherId ?? '—'}
						</td>
					</tr>
				{:else}
					<tr>
						<td class="px-4 py-6 text-center text-gray-500" colspan="3">멤버십이 없습니다.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
