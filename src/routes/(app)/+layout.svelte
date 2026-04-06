<script lang="ts">
  import { page } from '$app/stores'
  import type { LayoutData } from './$types'

  let { data, children }: { data: LayoutData, children: any } = $props()

  const navItems = [
    {
      href: '/visits',
      label: 'Visits',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
    },
    {
      href: '/route',
      label: 'Route',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`
    },
    {
      href: '/customers',
      label: 'Customers',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
    },
  ]

  function isActive(href: string): boolean {
    return $page.url.pathname.startsWith(href)
  }
</script>

<div class="min-h-screen bg-surface">
  <!-- Top nav — desktop only -->
  <nav class="hidden md:flex bg-card border-b border-border px-6 py-3 items-center justify-between">
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <span class="text-white text-xs font-bold">C</span>
        </div>
        <span class="font-semibold text-text">ClearWave</span>
      </div>
      <nav class="flex items-center gap-1">
        {#each navItems as item}
          <a href={item.href}
            class="px-3 py-1.5 text-sm rounded-lg transition-colors
                   {isActive(item.href) ? 'text-primary bg-primary/10' : 'text-muted hover:text-text hover:bg-surface'}">
            {item.label}
          </a>
        {/each}
      </nav>
    </div>
    <div class="flex items-center gap-4">
      <span class="text-sm text-muted">{data.user.email}</span>
      <form method="POST" action="/logout">
        <button type="submit" class="text-sm text-muted hover:text-text transition-colors">Sign out</button>
      </form>
    </div>
  </nav>

  <!-- Top bar mobile — logo + sign out -->
  <div class="md:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
        <span class="text-white text-xs font-bold">C</span>
      </div>
      <span class="font-semibold text-text">ClearWave</span>
    </div>
    <form method="POST" action="/logout">
      <button type="submit" class="text-sm text-muted hover:text-text transition-colors">Sign out</button>
    </form>
  </div>

  <!-- Content — padding bottom en mobile para el nav -->
  <main class="p-4 md:p-6 max-w-5xl mx-auto pb-24 md:pb-6">
    {@render children()}
  </main>

  <!-- Bottom nav — mobile only -->
  <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border px-2 py-2 z-50">
    <div class="flex items-center justify-around">
      {#each navItems as item}
        <a href={item.href}
          class="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors
                 {isActive(item.href) ? 'text-primary' : 'text-muted'}">
          {@html item.icon}
          <span class="text-xs font-medium">{item.label}</span>
        </a>
      {/each}
    </div>
  </nav>
</div>