<script lang="ts">
  import { enhance } from '$app/forms'
  import { goto } from '$app/navigation'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { visits, backlog, selectedDate, today, weekDates } = $derived(data)

  let skipVisitId = $state<string | null>(null)
  let skipReason = $state('')

  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

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

  function formatRecurrence(plan: any): string {
    if (!plan) return ''
    const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    const day = dayNames[plan.preferred_day_of_week]
    if (plan.recurrence === 'weekly') return `Every ${day}`
    if (plan.recurrence === 'fortnightly') return `Every 2nd ${day}`
    if (plan.recurrence === 'monthly') return `Monthly on ${day}s`
    return ''
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    if (dateStr === today) return 'Today'
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow'
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function changeWeek(offset: number) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset * 7)
    goto(`?date=${d.toISOString().split('T')[0]}`)
  }
</script>

<div class="max-w-2xl">
  <!-- Week strip -->
  <div class="bg-card border border-border rounded-xl mb-6 overflow-hidden">
    <!-- Month + week nav -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-border">
      <button onclick={() => changeWeek(-1)} class="p-1 text-muted hover:text-text transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <p class="text-sm font-medium text-text">
        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
      </p>
      <button onclick={() => changeWeek(1)} class="p-1 text-muted hover:text-text transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
    <!-- Days row -->
    <div class="grid grid-cols-7 px-2 py-2">
      {#each weekDates as wd, i}
        <button
          onclick={() => goto(`?date=${wd.date}`)}
          class="flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors
            {wd.date === selectedDate ? 'bg-primary' : 'hover:bg-surface'}"
        >
          <span class="text-xs {wd.date === selectedDate ? 'text-white' : 'text-muted'}">{days[i]}</span>
          <span class="text-sm font-medium {wd.date === selectedDate ? 'text-white' : wd.date === today ? 'text-primary' : 'text-text'}">
            {new Date(wd.date + 'T00:00:00').getDate()}
          </span>
          <!-- dot si hay visitas -->
          <span class="w-1 h-1 rounded-full {wd.hasVisits ? (wd.date === selectedDate ? 'bg-white' : 'bg-primary') : 'bg-transparent'}"></span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Day header -->
  <div class="mb-4">
    <h1 class="text-xl font-semibold text-text">{formatDate(selectedDate)}</h1>
    <p class="text-sm text-muted">
      {visits.filter((v: any) => v.status === 'completed').length}/{visits.length} completed
    </p>
  </div>

  <!-- Visits list -->
  {#if visits.length === 0}
    <div class="bg-card border border-border rounded-xl p-10 text-center text-muted text-sm mb-6">
      No visits scheduled for this day
    </div>
  {:else}
    <div class="space-y-3 mb-6">
      {#each visits as visit}
        <div class="bg-card border border-border rounded-xl overflow-hidden">
          {#if visit.status === 'in_progress' || visit.status === 'completed'}
            <a href="/visits/{visit.id}" class="block px-4 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-text truncate">{visit.properties?.customers?.name ?? '—'}</p>
                  <p class="text-xs text-muted mt-0.5 truncate">{visit.properties?.address}{#if visit.properties?.suburb}, {visit.properties.suburb}{/if}</p>
                  {#if visit.service_plans}<p class="text-xs text-primary mt-0.5">{formatRecurrence(visit.service_plans)}</p>{/if}
                  {#if visit.scheduled_time}<p class="text-xs text-muted mt-1">{formatTime(visit.scheduled_time)}</p>{/if}
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full border flex-shrink-0 capitalize {statusColors[visit.status]}">
                  {visit.status.replace('_', ' ')}
                </span>
              </div>
            </a>
          {:else}
            <div class="px-4 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-text truncate">{visit.properties?.customers?.name ?? '—'}</p>
                  <p class="text-xs text-muted mt-0.5 truncate">{visit.properties?.address}{#if visit.properties?.suburb}, {visit.properties.suburb}{/if}</p>
                  {#if visit.service_plans}<p class="text-xs text-primary mt-0.5">{formatRecurrence(visit.service_plans)}</p>{/if}
                  {#if visit.scheduled_time}<p class="text-xs text-muted mt-1">{formatTime(visit.scheduled_time)}</p>{/if}
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full border flex-shrink-0 capitalize {statusColors[visit.status]}">
                  {visit.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          {/if}

          {#if skipVisitId === visit.id}
            <div class="px-4 pb-3 border-t border-border">
              <form method="POST" action="?/skipVisit" use:enhance={() => {
                return async ({ update }) => { await update(); skipVisitId = null; skipReason = '' }
              }}>
                <input type="hidden" name="visitId" value={visit.id} />
                <input type="hidden" name="oldStatus" value={visit.status} />
                <p class="text-xs text-muted mt-3 mb-2">Why are you skipping?</p>
                <textarea name="skipReason" bind:value={skipReason} rows="2"
                  placeholder="e.g. Gate locked, no access"
                  class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"></textarea>
                <div class="flex gap-2 mt-2">
                  <button type="submit"
                    class="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors">
                    Confirm skip
                  </button>
                  <button type="button" onclick={() => skipVisitId = null}
                    class="py-1.5 px-3 border border-border text-xs rounded-lg hover:bg-surface transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          {:else if visit.status === 'pending' || visit.status === 'skipped'}
            <div class="px-4 pb-3 flex gap-2 border-t border-border pt-3">
              <form method="POST" action="?/startVisit" use:enhance class="flex-1">
                <input type="hidden" name="visitId" value={visit.id} />
                <input type="hidden" name="oldStatus" value={visit.status} />
                <button type="submit"
                  class="w-full py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark transition-colors">
                  Start visit
                </button>
              </form>
              <button type="button" onclick={() => { skipVisitId = visit.id; skipReason = '' }}
                class="py-2 px-4 border border-border text-xs text-muted rounded-lg hover:bg-surface transition-colors">
                Skip
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Backlog -->
  {#if backlog.length > 0}
    <div class="mb-3 flex items-center gap-2">
      <h2 class="text-base font-medium text-text">Backlog</h2>
      <span class="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-danger border border-red-200">{backlog.length}</span>
    </div>
    <div class="bg-card border border-border rounded-xl overflow-hidden">
      {#each backlog as visit, i}
        <div class="px-4 py-3 {i !== 0 ? 'border-t border-border' : ''}">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-text truncate">{visit.properties?.customers?.name ?? '—'}</p>
              <p class="text-xs text-muted truncate">{visit.properties?.address}</p>
              <p class="text-xs text-danger mt-0.5">
                {new Date(visit.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                {#if visit.skip_reason}· {visit.skip_reason}{/if}
              </p>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full border flex-shrink-0 capitalize {statusColors[visit.status]}">
              {visit.status}
            </span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>