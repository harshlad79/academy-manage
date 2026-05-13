<script lang="ts">
	import '../app.css';
	import Navigation from '$lib/components/Navigation.svelte';

	let { data, children } = $props();
</script>

<div class="flex min-h-screen bg-gray-50">
	<Navigation
		user={data.user}
		links={data.navLinks}
		brand={data.portalBrand ?? '학원 관리'}
		academySwitcher={data.academySwitcher}
	/>
	<main class="flex-1 p-8">
		{@render children()}
	</main>
</div>
