<script lang="ts">
  import type { PageData } from './$types'
  let { data }: { data: PageData } = $props()
</script>

<div class="max-w-2xl">
  <h1 class="text-xl font-semibold text-text mb-6">Settings</h1>

  <div class="bg-card border border-border rounded-xl overflow-hidden">
    <a href="/settings/products"
      class="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div>
          <p class="text-sm font-medium text-text">Products & Pricing</p>
          <p class="text-xs text-muted">Services and chemicals with unit prices</p>
        </div>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
    </a>
  </div>
</div>