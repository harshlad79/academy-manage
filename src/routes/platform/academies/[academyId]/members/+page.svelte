<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	type FormFlash = { error?: string };

	let { data, form }: { data: PageData; form?: FormFlash } = $props();

	function inviteMailStatusLabel(inv: PageData['inviteRows'][number]): string {
		if (inv.lastEmailSentAt) {
			return `발송됨 · ${inv.lastEmailSentAt.slice(0, 19).replace('T', ' ')} UTC`;
		}
		if (inv.lastEmailError) {
			return `실패 · ${inv.lastEmailError}`;
		}
		return '미발송';
	}

	let addRole = $state('academy_admin');
	let inviteRole = $state('academy_admin');
</script>

<section class="max-w-5xl">
	<p class="text-sm text-gray-500">
		<a
			href={resolve('/platform/academies')}
			class="font-medium text-indigo-600 hover:text-indigo-800">← 등록 학원</a
		>
	</p>
	<h1 class="mt-2 text-2xl font-semibold text-gray-900">멤버십 — {data.academyName}</h1>
	<p class="mt-1 text-sm text-gray-600">
		학원 ID <code class="rounded bg-gray-100 px-1 font-mono text-xs">{data.academyIdHex}</code> ·
		상태
		<span class="font-medium">{data.academyStatus}</span>
	</p>

	{#if data.noticeMessage}
		<p
			class="mt-4 rounded-md border px-4 py-3 text-sm {data.noticeMessage.includes('실패')
				? 'border-amber-200 bg-amber-50 text-amber-950'
				: 'border-emerald-200 bg-emerald-50 text-emerald-950'}"
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
		action="?/addMember"
		class="mt-6 max-w-xl rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
	>
		<h2 class="text-sm font-semibold text-gray-900">멤버 추가</h2>
		<p class="mt-1 text-xs text-gray-500">
			Better Auth <code class="font-mono">user.id</code> 문자열(목업: testuser, parent-kim 등). super_admin
			은 여기서 추가하지 않습니다.
		</p>
		<div class="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
			<div>
				<label for="m-user" class="block text-xs font-medium text-gray-600">사용자 ID</label>
				<input
					id="m-user"
					name="userId"
					type="text"
					maxlength="128"
					required
					class="mt-1 w-full min-w-[12rem] rounded border border-gray-300 px-2 py-1.5 text-sm sm:w-48"
					placeholder="예: parent-kim"
				/>
			</div>
			<div>
				<label for="m-role" class="block text-xs font-medium text-gray-600">역할</label>
				<select
					id="m-role"
					name="role"
					class="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm sm:w-40"
					required
					bind:value={addRole}
				>
					{#each data.inviteRoles as r (r)}
						<option value={r}>{r}</option>
					{/each}
				</select>
			</div>
			<div class={addRole === 'teacher' ? '' : 'opacity-60'}>
				<label for="m-teacher" class="block text-xs font-medium text-gray-600"
					>강사 프로필 (teacher)</label
				>
				<select
					id="m-teacher"
					name="linkedTeacherId"
					class="mt-1 w-full max-w-xs rounded border border-gray-300 px-2 py-1.5 text-sm"
					disabled={addRole !== 'teacher'}
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
				추가
			</button>
		</div>
	</form>

	<form
		method="POST"
		action="?/createInvite"
		class="mt-6 max-w-xl rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 shadow-sm"
	>
		<h2 class="text-sm font-semibold text-gray-900">이메일 초대 (대기)</h2>
		<p class="mt-1 text-xs text-gray-500">
			수락 URL은 초대당 고유 토큰이며, 만료는 약 14일입니다. 동일 이메일로 다시 보내면 이전 링크는
			대체됩니다.
		</p>
		<div class="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
						<th class="px-4 py-2 text-left font-medium text-gray-700">이메일</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">역할</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">만료(UTC)</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">메일</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">수락 링크</th>
						<th class="px-4 py-2 text-left font-medium text-gray-700">작업</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#each data.inviteRows as inv (inv.id)}
						<tr>
							<td class="px-4 py-2 font-mono text-xs text-gray-900">{inv.email}</td>
							<td class="px-4 py-2 text-gray-800">{inv.role}</td>
							<td class="px-4 py-2 text-xs text-gray-600">{inv.expiresAt}</td>
							<td class="max-w-[10rem] px-4 py-2 text-xs text-gray-700">
								<span
									class={inv.lastEmailError
										? 'text-amber-800'
										: inv.lastEmailSentAt
											? 'text-emerald-800'
											: 'text-gray-500'}>{inviteMailStatusLabel(inv)}</span
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
								<form method="POST" action="?/resendInvite" class="mr-3 inline">
									<input type="hidden" name="inviteId" value={inv.id} />
									<button
										type="submit"
										class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
									>
										메일 재발송
									</button>
								</form>
								<form method="POST" action="?/revokeInvite" class="inline">
									<input type="hidden" name="inviteId" value={inv.id} />
									<button type="submit" class="text-sm font-medium text-red-600 hover:text-red-800">
										철회
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
		<table class="min-w-full divide-y divide-gray-200 text-sm">
			<thead class="bg-gray-50">
				<tr>
					<th class="px-4 py-2 text-left font-medium text-gray-700">사용자 ID</th>
					<th class="px-4 py-2 text-left font-medium text-gray-700">역할</th>
					<th class="px-4 py-2 text-left font-medium text-gray-700">강사 연결</th>
					<th class="px-4 py-2 text-left font-medium text-gray-700">작업</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100">
				{#each data.rows as row (row.userId + row.role)}
					<tr>
						<td class="px-4 py-2 font-mono text-xs text-gray-900">{row.userId}</td>
						<td class="px-4 py-2 text-gray-800">{row.role}</td>
						<td class="px-4 py-2 align-top text-xs text-gray-700">
							{#if row.role === 'teacher'}
								<form
									method="POST"
									action="?/updateLinkedTeacher"
									class="flex max-w-md flex-col gap-2 sm:flex-row sm:items-center"
								>
									<input type="hidden" name="userId" value={row.userId} />
									<select
										name="linkedTeacherId"
										class="w-full min-w-[10rem] flex-1 rounded border border-gray-300 px-2 py-1 font-sans text-xs"
										value={row.linkedTeacherId ?? ''}
									>
										<option value="">미연결</option>
										{#each data.teacherOptions as opt (opt.id)}
											<option value={opt.id}
												>{opt.name}{#if opt.subject}&nbsp;· {opt.subject}{/if}</option
											>
										{/each}
									</select>
									<button
										type="submit"
										class="shrink-0 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-200"
									>
										연결 저장
									</button>
								</form>
								{#if row.linkedTeacherId}
									<p class="mt-1 font-mono text-[11px] text-gray-500">{row.linkedTeacherId}</p>
								{/if}
							{:else if row.linkedTeacherId}
								<span class="font-medium">{row.linkedTeacherName ?? '—'}</span>
								<span class="mt-0.5 block font-mono text-[11px] text-gray-500"
									>{row.linkedTeacherId}</span
								>
							{:else}
								<span class="text-gray-400">—</span>
							{/if}
						</td>
						<td class="px-4 py-2">
							<form method="POST" action="?/removeMember" class="inline">
								<input type="hidden" name="userId" value={row.userId} />
								<input type="hidden" name="role" value={row.role} />
								<button type="submit" class="text-sm font-medium text-red-600 hover:text-red-800">
									삭제
								</button>
							</form>
						</td>
					</tr>
				{:else}
					<tr>
						<td class="px-4 py-6 text-center text-gray-500" colspan="4">멤버십이 없습니다.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
