<script lang="ts">
  import type { LayoutData } from './$types'
  let { data, children }: { data: LayoutData, children: any } = $props()
</script>

<div class="min-h-screen bg-surface">
  <!-- Nav -->
  <nav class="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <span class="text-white text-xs font-bold">C</span>
        </div>
        <span class="font-semibold text-text">ClearWave</span>
      </div>
      <nav class="hidden md:flex items-center gap-1">
        <a href="/dashboard" class="px-3 py-1.5 text-sm text-muted hover:text-text rounded-lg hover:bg-surface transition-colors">Dashboard</a>
        <a href="/visits" class="px-3 py-1.5 text-sm text-muted hover:text-text rounded-lg hover:bg-surface transition-colors">Visits</a>
        <a href="/customers" class="px-3 py-1.5 text-sm text-muted hover:text-text rounded-lg hover:bg-surface transition-colors">Customers</a>
      </nav>
    </div>
    <div class="flex items-center gap-4">
      <span class="text-sm text-muted">{data.user.email}</span>
      <form method="POST" action="/logout">
        <button type="submit" class="text-sm text-muted hover:text-text transition-colors">
          Sign out
        </button>
      </form>
    </div>
  </nav>

  <!-- Content -->
  <main class="p-4 md:p-6 max-w-5xl mx-auto">
    {@render children()}
  </main>
</div>