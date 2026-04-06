<script lang="ts">
  import { enhance } from '$app/forms'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { visit, lastVisit, hasChecklist } = $derived(data)

  let showSkip = $state(false)
  let skipReason = $state('')
  let fromRoute = $state(false)

  onMount(() => {
    // Si viene con ?from=route, guardarlo
    if (data.fromRoute) {
      sessionStorage.setItem(`visit_origin_${visit.id}`, 'route')
      fromRoute = true
    } else {
      // Leer el origen guardado
      const saved = sessionStorage.getItem(`visit_origin_${visit.id}`)
      fromRoute = saved === 'route'
    }
  })

  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

  function formatTime(t: string | null): string {
    if (!t) return ''
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    const ampm = h < 12 ? 'AM' : 'PM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short'
    })
  }

  function formatRecurrence(plan: any): string {
    if (!plan) return ''
    const day = days[plan.preferred_day_of_week]
    if (plan.recurrence === 'weekly') return `Every ${day}`
    if (plan.recurrence === 'fortnightly') return `Every 2nd ${day}`
    if (plan.recurrence === 'monthly') return `Monthly on ${day}s`
    return ''
  }

  let equipment = $derived(visit.service_plans?.pool_equipment ?? {})
</script>

<div class="max-w-2xl">
  <!-- Header -->
  <div class="mb-4">
    <div class="flex items-center gap-3 mb-2">
      {#if fromRoute}
        <a href="/route" class="text-sm text-muted hover:text-text transition-colors">← Route</a>
      {:else}
        <a href="/visits" class="text-sm text-muted hover:text-text transition-colors">← Visits</a>
      {/if}
    </div>
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-xl font-semibold text-text">{visit.properties?.customers?.name ?? '—'}</h1>
        <p class="text-sm text-muted mt-0.5">{visit.properties?.address}{#if visit.properties?.suburb}, {visit.properties.suburb}{/if}</p>
        {#if visit.service_plans}
          <p class="text-xs text-primary mt-0.5">{formatRecurrence(visit.service_plans)}</p>
        {/if}
        {#if visit.scheduled_time}
          <p class="text-xs text-muted mt-0.5">{formatTime(visit.scheduled_time)}</p>
        {/if}
      </div>
      <span class="text-xs px-2 py-1 rounded-full border capitalize flex-shrink-0
        {visit.status === 'in_progress' ? 'bg-amber-50 text-amber-600 border-amber-200' :
         visit.status === 'completed' ? 'bg-green-50 text-green-600 border-green-200' :
         visit.status === 'skipped' ? 'bg-slate-100 text-slate-500 border-slate-200' :
         'bg-blue-50 text-blue-600 border-blue-200'}">
        {visit.status.replace('_', ' ')}
      </span>
    </div>
  </div>

  <!-- Last visit banner -->
  {#if visit.status === 'in_progress' || visit.status === 'completed'}
    {#if lastVisit}
      <a href="/visits/{lastVisit.id}/checklist/view"
        class="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 hover:bg-blue-100 transition-colors">
        <div>
          <p class="text-xs text-blue-500">Last visit</p>
          <p class="text-sm font-medium text-blue-700">
            {formatDate(lastVisit.scheduled_date)}
            {#if lastVisit.scheduled_time}· {formatTime(lastVisit.scheduled_time)}{/if}
          </p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </a>
    {:else}
      <div class="bg-slate-50 border border-border rounded-xl px-4 py-3 mb-4">
        <p class="text-xs text-muted">No previous visits</p>
      </div>
    {/if}
  {/if}

  <!-- Pool info -->
  <div class="bg-card border border-border rounded-xl divide-y divide-border mb-4">
    {#each [
      { label: 'Pool type', value: visit.properties?.pool_type },
      { label: 'Volume', value: visit.properties?.pool_volume_litres ? `${visit.properties.pool_volume_litres.toLocaleString()}L` : null },
      { label: 'Pump', value: equipment.pump },
      { label: 'Filter', value: equipment.filter },
      { label: 'Chlorinator', value: equipment.chlorinator },
      { label: 'Notes', value: visit.properties?.notes },
    ] as row}
      {#if row.value}
        <div class="px-4 py-3 flex gap-4">
          <span class="text-sm text-muted w-24 flex-shrink-0">{row.label}</span>
          <span class="text-sm text-text capitalize">{row.value}</span>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Contact -->
  {#if visit.properties?.customers?.phone || visit.properties?.customers?.email}
    <div class="bg-card border border-border rounded-xl divide-y divide-border mb-6">
      {#if visit.properties.customers.phone}
        <a href="tel:{visit.properties.customers.phone}" class="px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.64 3.43 2 2 0 0 1 3.6 1.25h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span class="text-sm text-text">{visit.properties.customers.phone}</span>
        </a>
      {/if}
      {#if visit.properties.customers.email}
        <a href="mailto:{visit.properties.customers.email}" class="px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span class="text-sm text-text">{visit.properties.customers.email}</span>
        </a>
      {/if}
    </div>
  {/if}

  <!-- Actions (solo si in_progress) -->
  {#if visit.status === 'in_progress'}
    <a href="/visits/{visit.id}/checklist{fromRoute ? '?from=route' : ''}"
      class="flex items-center justify-between {hasChecklist ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'} border rounded-xl px-4 py-3 mb-3 hover:bg-surface transition-colors">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full {hasChecklist ? 'bg-primary/20' : 'bg-primary/10'} flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#0EA5E9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <div>
          <span class="text-sm font-medium text-text">{hasChecklist ? 'Edit checklist' : 'Fill checklist'}</span>
          {#if hasChecklist}
            <p class="text-xs text-primary">Checklist completed ✓</p>
          {/if}
        </div>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
    </a>

    {#if showSkip}
      <form method="POST" action="?/skip{fromRoute ? '&from=route' : ''}" use:enhance class="mb-3">
        <p class="text-sm font-medium text-text mb-2">Why are you skipping?</p>
        <textarea name="skipReason" bind:value={skipReason} rows="2"
          placeholder="e.g. Gate locked, no access"
          class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary resize-none mb-2"
        ></textarea>
        <div class="flex gap-2">
          <button type="submit"
            class="flex-1 py-2.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors">
            Confirm skip
          </button>
          <button type="button" onclick={() => showSkip = false}
            class="py-2.5 px-4 border border-border text-sm rounded-lg hover:bg-surface transition-colors">
            Cancel
          </button>
        </div>
      </form>
    {:else}
      <div class="flex gap-3 mb-3">
        <form method="POST" action="?/complete{fromRoute ? '&from=route' : ''}" use:enhance class="flex-1">
          <button type="submit"
            class="w-full py-3 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 transition-colors">
            Complete visit
          </button>
        </form>
        <button type="button" onclick={() => showSkip = true}
          class="py-3 px-5 border border-border text-sm text-muted rounded-xl hover:bg-surface transition-colors">
          Skip
        </button>
      </div>
    {/if}

    {#if fromRoute}
      <a href="/route"
        class="flex items-center justify-center gap-2 w-full py-3 border border-border rounded-xl text-sm font-medium text-text hover:bg-surface transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        Back to route
      </a>
    {/if}
  {/if}

  <!-- Completed state -->
  {#if visit.status === 'completed'}
    <a href="/visits/{visit.id}/checklist{fromRoute ? '?from=route' : ''}"
      class="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 hover:bg-green-100 transition-colors mb-3">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <span class="text-sm font-medium text-green-700">View / edit checklist</span>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
    </a>
    {#if fromRoute}
      <a href="/route"
        class="flex items-center justify-center gap-2 w-full py-3 border border-border rounded-xl text-sm font-medium text-text hover:bg-surface transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        Back to route
      </a>
    {/if}
  {/if}
</div>