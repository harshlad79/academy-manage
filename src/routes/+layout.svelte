<script>
  import '../app.css';
  import Navigation from '$lib/components/Navigation.svelte';
</script>

<div class="min-h-screen bg-gray-50 flex">
  <Navigation />
  <main class="flex-1 p-8">
    <slot />
  </main>
</div>
