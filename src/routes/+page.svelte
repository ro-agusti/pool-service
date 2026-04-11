<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { user, session } = $derived(data)

  const features = [
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`,
      title: 'AI-optimized routes',
      desc: 'Your day sorted by distance and priority. The AI also tells you what to do next based on your location and backlog.'
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>`,
      title: 'Works without signal',
      desc: 'Complete checklists and log water tests even offline. Everything syncs automatically when you reconnect.'
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      title: 'Instant invoices',
      desc: 'Chemicals used + services done = invoice ready. PDF in one tap, sent straight to your client.'
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      title: 'Nearby visit suggestions',
      desc: "Going to Noosa? See what other clients are nearby so you don't make the same trip twice."
    },
  ]

  const navItems = [
    {
      href: '/visits',
      label: 'Visits',
      desc: "Today's schedule",
      color: 'bg-sky-50 text-sky-600 border-sky-200',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
    },
    {
      href: '/route',
      label: 'Route',
      desc: 'Optimized map',
      color: 'bg-violet-50 text-violet-600 border-violet-200',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`
    },
    {
      href: '/customers',
      label: 'Customers',
      desc: 'Clients & pools',
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
    },
    {
      href: '/settings',
      label: 'Settings',
      desc: 'Products & pricing',
      color: 'bg-amber-50 text-amber-600 border-amber-200',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
    },
  ]
</script>

{#if session}
  <!-- ── LOGGED IN VIEW ── -->
  <div class="min-h-screen bg-surface flex flex-col">
    <div class="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
          <span class="text-white text-sm font-bold">C</span>
        </div>
        <span class="font-semibold text-text text-lg">ClearWave</span>
      </div>
      <form method="POST" action="/logout">
        <button type="submit" class="text-sm text-muted hover:text-text transition-colors">Sign out</button>
      </form>
    </div>

    <div class="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
      <div class="mb-8">
        <p class="text-sm text-muted">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}</p>
        <h1 class="text-2xl font-semibold text-text mt-0.5">{user?.name ?? 'Welcome back'} 👋</h1>
      </div>

      <div class="grid grid-cols-2 gap-3">
        {#each navItems as item}
          <a href={item.href}
            class="bg-card border border-border rounded-2xl p-5 hover:bg-surface transition-colors flex flex-col gap-3">
            <div class="w-10 h-10 rounded-xl border flex items-center justify-center {item.color}">
              {@html item.icon}
            </div>
            <div>
              <p class="text-sm font-semibold text-text">{item.label}</p>
              <p class="text-xs text-muted mt-0.5">{item.desc}</p>
            </div>
          </a>
        {/each}
      </div>
    </div>
  </div>

{:else}
  <!-- ── LANDING PAGE ── -->
  <div class="min-h-screen bg-white flex flex-col">

    <!-- Buttons top right -->
    <div class="px-6 py-4 flex justify-end gap-3">
      <a href="/login" class="text-sm text-slate-500 hover:text-slate-900 transition-colors">Log in</a>
      <a href="/register" class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-sky-600 transition-colors">
        Get started
      </a>
    </div>

    <!-- Hero -->
    <div class="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center max-w-2xl mx-auto w-full">
      <!-- Logo -->
      <div class="flex flex-col items-center gap-3 mb-8">
        <div class="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center shadow-lg shadow-sky-200">
          <span class="text-white text-3xl font-bold">C</span>
        </div>
        <span class="font-bold text-slate-900 text-2xl tracking-tight">ClearWave</span>
      </div>

      <h1 class="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-4">
        Run your pool round<br>
        <span class="text-primary">smarter, not harder</span>
      </h1>

      <p class="text-lg text-slate-500 mb-8 max-w-md">
        ClearWave optimizes your daily route, tells you what to do next, and generates invoices automatically — all from your phone.
      </p>

      <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <a href="/register"
          class="px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-sky-600 transition-colors text-center">
          Start free trial
        </a>
        <a href="/login"
          class="px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors text-center">
          Log in
        </a>
      </div>
    </div>

    <!-- Features -->
    <div class="px-6 pb-16 max-w-2xl mx-auto w-full">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {#each features as f}
          <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <div class="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              {@html f.icon}
            </div>
            <p class="text-sm font-semibold text-slate-900 mb-1">{f.title}</p>
            <p class="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
          </div>
        {/each}
      </div>
    </div>

  </div>
{/if}