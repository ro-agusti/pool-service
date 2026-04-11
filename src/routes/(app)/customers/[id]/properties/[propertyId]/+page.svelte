<script lang="ts">
  import { enhance } from '$app/forms'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { property, customer, plans, nextVisit, visitHistory } = $derived(data)

  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  let activePlan = $derived(plans.find((p: any) => p.active) ?? null)
  let filter = $state<'active' | 'inactive' | 'all'>('active')
  let filteredPlans = $derived(
    filter === 'all' ? plans :
    filter === 'active' ? plans.filter((p: any) => p.active) :
    plans.filter((p: any) => !p.active)
  )
  let openServicePlan = $state(true)
  let openHistory = $state(true)
  let historyFilter = $state<string>('all')
  let filteredHistory = $derived(
    historyFilter === 'all' ? (visitHistory ?? []) :
    (visitHistory ?? []).filter((v: any) => v.status === historyFilter)
  )

  const statusColors: Record<string, string> = {
    pending:     'bg-blue-50 text-blue-600 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-600 border-amber-200',
    completed:   'bg-green-50 text-green-600 border-green-200',
    skipped:     'bg-slate-100 text-slate-500 border-slate-200',
    cancelled:   'bg-red-50 text-red-400 border-red-200',
  }

  function formatTime(t: string | null): string {
    if (!t) return ''
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    const ampm = h < 12 ? 'AM' : 'PM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    })
  }
</script>

<div class="max-w-2xl">
  <!-- Header -->
  <div class="mb-6">
    <a href="/customers/{customer?.id}" class="text-sm text-muted hover:text-text transition-colors">
      ← {customer?.name}
    </a>
    <div class="flex items-start justify-between mt-2">
      <div>
        <h1 class="text-xl font-semibold text-text">{property.address}</h1>
        <p class="text-sm text-muted mt-0.5">
          {[property.suburb, property.state, property.postcode].filter(Boolean).join(' ')}
        </p>
      </div>
      <a href="/customers/{customer?.id}/properties/{property.id}/edit"
        class="p-2 border border-border rounded-lg text-muted hover:text-text hover:bg-surface transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </a>
    </div>
  </div>

  <!-- Next visit -->
  <div class="bg-card border border-border rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#0EA5E9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div>
        <p class="text-xs text-muted">Next visit</p>
        {#if nextVisit}
          <p class="text-sm font-medium text-text">
            {new Date(nextVisit.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
            {#if nextVisit.scheduled_time}· {formatTime(nextVisit.scheduled_time)}{/if}
          </p>
        {:else}
          <p class="text-sm text-muted">No upcoming visits</p>
        {/if}
      </div>
    </div>
    {#if nextVisit}
      <span class="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-primary capitalize">
        {nextVisit.status}
      </span>
    {/if}
  </div>

  <!-- Pool details -->
  <div class="bg-card border border-border rounded-xl divide-y divide-border mb-8">
    {#each [
      { label: 'Pool type', value: property.pool_type },
      { label: 'Volume', value: property.pool_volume_litres ? `${property.pool_volume_litres.toLocaleString()}L` : null },
      { label: 'Notes', value: property.notes },
    ] as row}
      {#if row.value}
        <div class="px-4 py-3 flex gap-4">
          <span class="text-sm text-muted w-24 flex-shrink-0">{row.label}</span>
          <span class="text-sm text-text capitalize">{row.value}</span>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Service plan accordion -->
  <div class="mb-6">
    <button type="button" onclick={() => openServicePlan = !openServicePlan}
      class="w-full flex items-center justify-between mb-2">
      <h2 class="text-lg font-medium text-text">Service plan</h2>
      <div class="flex items-center gap-2">
        {#if openServicePlan}
          {#if !activePlan}
            <a href="/customers/{customer?.id}/properties/{property.id}/plans/new"
              onclick={(e) => e.stopPropagation()}
              class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
              <span class="text-lg leading-none">+</span>
              <span class="hidden sm:inline">Add plan</span>
            </a>
          {:else}
            <div class="relative group" onclick={(e) => e.stopPropagation()}>
              <button type="button"
                class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-400 text-sm font-medium rounded-lg cursor-not-allowed">
                <span class="text-lg leading-none">+</span>
                <span class="hidden sm:inline">Add plan</span>
              </button>
              <div class="absolute right-0 top-full mt-1.5 w-56 bg-text text-white text-xs rounded-lg px-3 py-2 hidden group-hover:block z-10 shadow-lg">
                To add a new plan, deactivate the current active plan first.
              </div>
            </div>
          {/if}
        {/if}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"
          class="text-muted transition-transform {openServicePlan ? 'rotate-180' : ''}">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </button>

    {#if openServicePlan}
      <div class="flex mb-3">
        <div class="flex rounded-lg border border-border overflow-hidden text-xs">
          {#each [['active','Active'],['inactive','Inactive'],['all','All']] as [val, label]}
            <button type="button" onclick={() => filter = val as any}
              class="px-3 py-1.5 transition-colors {filter === val ? 'bg-primary text-white' : 'bg-card text-muted hover:bg-surface'}">
              {label}
            </button>
          {/each}
        </div>
      </div>

      {#if filteredPlans.length === 0}
        <div class="bg-card border border-border rounded-xl p-8 text-center text-muted text-sm">
          {filter === 'active' ? 'No active service plan' : filter === 'inactive' ? 'No inactive plans' : 'No service plans yet'}
        </div>
      {:else}
        <div class="bg-card border border-border rounded-xl overflow-hidden">
          {#each filteredPlans as plan, i}
            <div class="px-4 py-3 {i !== 0 ? 'border-t border-border' : ''}">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-sm font-medium text-text capitalize">{plan.recurrence}</p>
                  <p class="text-sm text-muted mt-1">Every {days[plan.preferred_day_of_week]} at {formatTime(plan.preferred_time)}</p>
                  {#if plan.pool_equipment?.pump || plan.pool_equipment?.filter || plan.pool_equipment?.chlorinator}
                    <div class="mt-2 space-y-0.5">
                      {#if plan.pool_equipment.pump}<p class="text-xs text-muted">Pump: <span class="text-text">{plan.pool_equipment.pump}</span></p>{/if}
                      {#if plan.pool_equipment.filter}<p class="text-xs text-muted">Filter: <span class="text-text">{plan.pool_equipment.filter}</span></p>{/if}
                      {#if plan.pool_equipment.chlorinator}<p class="text-xs text-muted">Chlorinator: <span class="text-text">{plan.pool_equipment.chlorinator}</span></p>{/if}
                    </div>
                  {/if}
                  {#if plan.notes}<p class="text-xs text-muted mt-1">{plan.notes}</p>{/if}
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-xs px-2 py-0.5 rounded-full {plan.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">
                    {plan.active ? 'Active' : 'Inactive'}
                  </span>
                  <a href="/customers/{customer?.id}/properties/{property.id}/plans/{plan.id}/edit"
                    class="p-2 border border-border rounded-lg text-muted hover:text-text hover:bg-surface transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </a>
                  <form method="POST" action="/customers/{customer?.id}/properties/{property.id}/plans/{plan.id}/edit?/delete" use:enhance>
                    <button type="submit" class="p-2 border border-border rounded-lg text-muted hover:text-danger hover:bg-red-50 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <!-- Visit history accordion -->
  {#if visitHistory && visitHistory.length > 0}
    <div class="mt-4">
      <button type="button" onclick={() => openHistory = !openHistory}
        class="w-full flex items-center justify-between mb-3">
        <h2 class="text-lg font-medium text-text">Visit history</h2>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"
          class="text-muted transition-transform {openHistory ? 'rotate-180' : ''}">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {#if openHistory}
        <!-- Filtros -->
        <div class="mb-3">
          <select
            onchange={(e) => historyFilter = (e.target as HTMLSelectElement).value}
            class="md:hidden w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            {#each [['all','All'],['completed','Completed'],['in_progress','In progress'],['skipped','Skipped'],['cancelled','Cancelled'],['pending','Pending']] as [val, label]}
              <option value={val} selected={historyFilter === val}>{label}</option>
            {/each}
          </select>
          <div class="hidden md:flex rounded-lg border border-border overflow-hidden text-xs">
            {#each [['all','All'],['completed','Completed'],['in_progress','In progress'],['skipped','Skipped'],['cancelled','Cancelled'],['pending','Pending']] as [val, label]}
              <button type="button" onclick={() => historyFilter = val}
                class="px-3 py-1.5 transition-colors whitespace-nowrap {historyFilter === val ? 'bg-primary text-white' : 'bg-card text-muted hover:bg-surface'}">
                {label}
              </button>
            {/each}
          </div>
        </div>

        {#if filteredHistory.length === 0}
          <div class="bg-card border border-border rounded-xl p-6 text-center text-muted text-sm">
            No visits with this status
          </div>
        {:else}
          <div class="bg-card border border-border rounded-xl overflow-hidden">
            {#each filteredHistory as visit, i}
              <a href="/visits/{visit.id}?from=customer&propertyId={property.id}"
                class="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface transition-colors {i !== 0 ? 'border-t border-border' : ''}">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-text">{formatDate(visit.scheduled_date)}</p>
                  {#if visit.scheduled_time}
                    <p class="text-xs text-muted mt-0.5">{formatTime(visit.scheduled_time)}</p>
                  {/if}
                  {#if visit.skip_reason}
                    <p class="text-xs text-muted mt-0.5 italic">"{visit.skip_reason}"</p>
                  {/if}
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  {#if visit.hasChecklist}
                    <span class="p-1.5 bg-primary/10 text-primary rounded-lg" title="Has checklist">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    </span>
                  {/if}
                  {#if visit.invoiceStatus}
                    <span class="text-xs px-2 py-0.5 rounded-full border capitalize
                      {visit.invoiceStatus === 'paid' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-200'}">
                      $ {visit.invoiceStatus}
                    </span>
                  {/if}
                  <span class="text-xs px-2 py-0.5 rounded-full border capitalize {statusColors[visit.status]}">
                    {visit.status.replace('_', ' ')}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" class="text-muted"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </a>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>