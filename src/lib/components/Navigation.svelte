<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AppNavLink } from '$lib/server/rbac';
	import type { User } from 'better-auth/types';

	let {
		user,
		links,
		brand = '학원 관리',
		academySwitcher = null
	}: {
		user: User | null;
		links: readonly AppNavLink[];
		brand?: string;
		academySwitcher?: {
			formAction: string;
			currentId: string;
			items: { id: string; name: string; status: string }[];
		} | null;
	} = $props();
</script>

<aside class="w-64 shrink-0 border-r border-gray-200 bg-white p-4">
	<h1 class="mb-6 text-xl font-bold text-gray-900">{brand}</h1>
	{#if user}
		<p class="mb-4 truncate text-sm text-gray-600" title={user.email ?? user.name ?? user.id}>
			{user.name ?? user.email ?? user.id}
		</p>
	{/if}
	{#if academySwitcher}
		<form
			method="POST"
			action={academySwitcher.formAction}
			class="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3"
		>
			<label for="nav-active-academy" class="block text-xs font-medium text-gray-500"
				>활성 학원</label
			>
			<div class="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
				<select
					id="nav-active-academy"
					name="academyId"
					class="block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 sm:max-w-[12rem]"
				>
					{#each academySwitcher.items as item (item.id)}
						<option value={item.id} selected={item.id === academySwitcher.currentId}>
							{item.name}{item.status === 'inactive' ? ' (비활성)' : ''}
						</option>
					{/each}
				</select>
				<button
					type="submit"
					class="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
				>
					전환
				</button>
			</div>
		</form>
	{/if}
	<nav class="space-y-1">
		{#each links as { href, label } (href)}
			<a
				href={resolve(href)}
				class="block rounded-md p-2 text-gray-700 hover:bg-gray-100"
				data-sveltekit-preload-data="tap"
			>
				{label}
			</a>
		{/each}
	</nav>
</aside>
