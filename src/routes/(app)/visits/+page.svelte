<script lang="ts">
  import { enhance } from '$app/forms'
  import { goto } from '$app/navigation'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { visits, backlog, selectedDate, today, weekDates, monthMap, monthYear } = $derived(data)

  let view = $state<'day' | 'month'>('day')
  let skipVisitId = $state<string | null>(null)
  let skipReason = $state('')

  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

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
    if (dateStr === today) return 'Today'
    const [y, m, d] = dateStr.split('-').map(Number)
    const tmp = new Date(y, m - 1, d)
    const [ty, tm, td] = today.split('-').map(Number)
    const tmw = new Date(ty, tm - 1, td + 1)
    if (tmp.getTime() === tmw.getTime()) return 'Tomorrow'
    return tmp.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function addDaysToStr(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const months = [0,31,28,31,30,31,30,31,31,30,31,30,31]
    const isLeap = (yr: number) => yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)
    let cy = y, cm = m, cd = d + days
    while (cd < 1) { cm--; if (cm < 1) { cm = 12; cy-- } cd += months[cm] + (cm === 2 && isLeap(cy) ? 1 : 0) }
    while (true) { const dim = months[cm] + (cm === 2 && isLeap(cy) ? 1 : 0); if (cd <= dim) break; cd -= dim; cm++; if (cm > 12) { cm = 1; cy++ } }
    return `${cy}-${String(cm).padStart(2,'0')}-${String(cd).padStart(2,'0')}`
  }

  function dowOf(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number)
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
    const yr = m < 3 ? y - 1 : y
    const dow = (yr + Math.floor(yr/4) - Math.floor(yr/100) + Math.floor(yr/400) + t[m-1] + d) % 7
    return (dow + 6) % 7
  }

  let monthGrid = $derived.by(() => {
    const { year: y, month: m } = monthYear
    const daysInMonth = [0,31,28,31,30,31,30,31,31,30,31,30,31]
    const isLeap = (yr: number) => yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)
    const dim = daysInMonth[m] + (m === 2 && isLeap(y) ? 1 : 0)
    const firstDay = dowOf(`${y}-${String(m).padStart(2,'0')}-01`)
    const cells: (string | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= dim; d++) {
      cells.push(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  })

  function changeWeek(offset: number) {
    goto(`?date=${addDaysToStr(selectedDate, offset * 7)}`)
  }

  function changeMonth(offset: number) {
    const { year: y, month: m } = monthYear
    let ny = y, nm = m + offset
    if (nm > 12) { nm = 1; ny++ }
    if (nm < 1) { nm = 12; ny-- }
    const newDate = `${ny}-${String(nm).padStart(2,'0')}-01`
    goto(`?date=${newDate}`)
  }

  function selectDay(date: string) {
    view = 'day'
    goto(`?date=${date}`)
  }
</script>

<div class="max-w-2xl">

  <!-- Toggle Day / Month -->
  <div class="flex items-center gap-1 mb-4 bg-surface border border-border rounded-lg p-1 w-fit">
    <button
      onclick={() => view = 'day'}
      class="px-3 py-1 text-sm rounded-md transition-colors {view === 'day' ? 'bg-white text-text font-medium shadow-sm' : 'text-muted hover:text-text'}"
    >Day</button>
    <button
      onclick={() => view = 'month'}
      class="px-3 py-1 text-sm rounded-md transition-colors {view === 'month' ? 'bg-white text-text font-medium shadow-sm' : 'text-muted hover:text-text'}"
    >Month</button>
  </div>

  {#if view === 'month'}
    <!-- MONTH VIEW -->
    <div class="bg-card border border-border rounded-xl overflow-hidden mb-6">
      <div class="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onclick={() => changeMonth(-1)} class="p-1 text-muted hover:text-text transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <p class="text-sm font-medium text-text">{monthNames[monthYear.month - 1]} {monthYear.year}</p>
        <button onclick={() => changeMonth(1)} class="p-1 text-muted hover:text-text transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="grid grid-cols-7 border-b border-border">
        {#each days as d}
          <div class="py-2 text-center text-xs text-muted font-medium">{d}</div>
        {/each}
      </div>

      <div class="grid grid-cols-7">
        {#each monthGrid as cell, i}
          {#if cell === null}
            <div class="min-h-[52px] {i % 7 !== 6 ? 'border-r' : ''} border-b border-border/50 bg-surface/50"></div>
          {:else}
            {@const info = monthMap[cell]}
            {@const isSelected = cell === selectedDate}
            {@const isToday = cell === today}
            <button
              onclick={() => selectDay(cell)}
              class="min-h-[52px] p-1.5 flex flex-col items-center gap-1 transition-colors
                {i % 7 !== 6 ? 'border-r' : ''} border-b border-border/50
                {isSelected ? 'bg-primary/10' : 'hover:bg-surface'}"
            >
              <span class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium
                {isSelected ? 'bg-primary text-white' : isToday ? 'text-primary font-bold' : 'text-text'}">
                {Number(cell.split('-')[2])}
              </span>
              {#if info}
                <div class="flex gap-0.5 flex-wrap justify-center">
                  {#each Array(Math.min(info.total, 4)) as _, j}
                    <span class="w-1.5 h-1.5 rounded-full {j < info.completed ? 'bg-green-500' : 'bg-primary'}"></span>
                  {/each}
                  {#if info.total > 4}
                    <span class="text-[9px] text-muted leading-none">+{info.total - 4}</span>
                  {/if}
                </div>
              {/if}
            </button>
          {/if}
        {/each}
      </div>
    </div>

    <div class="flex items-center gap-4 mb-6 px-1">
      <div class="flex items-center gap-1.5 text-xs text-muted">
        <span class="w-2 h-2 rounded-full bg-primary"></span> Pending
      </div>
      <div class="flex items-center gap-1.5 text-xs text-muted">
        <span class="w-2 h-2 rounded-full bg-green-500"></span> Completed
      </div>
    </div>

    {#if visits.length > 0}
      <div class="mb-3">
        <h2 class="text-base font-medium text-text">{formatDate(selectedDate)}</h2>
        <p class="text-xs text-muted">{visits.filter((v: any) => v.status === 'completed').length}/{visits.length} completed</p>
      </div>
      <div class="space-y-2 mb-6">
        {#each visits as visit}
          <a href="/visits/{visit.id}" class="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-text truncate">{visit.properties?.customers?.name ?? '—'}</p>
              <p class="text-xs text-muted truncate">{visit.properties?.address}{#if visit.properties?.suburb}, {visit.properties.suburb}{/if}</p>
              {#if visit.technician_name}<p class="text-xs text-muted mt-0.5">👤 {visit.technician_name}</p>{/if}
              {#if visit.scheduled_time}<p class="text-xs text-muted mt-0.5">{formatTime(visit.scheduled_time)}</p>{/if}
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full border flex-shrink-0 capitalize {statusColors[visit.status]}">
              {visit.status.replace('_', ' ')}
            </span>
          </a>
        {/each}
      </div>
    {:else if selectedDate}
      <p class="text-sm text-muted text-center py-6">No visits on {formatDate(selectedDate)}</p>
    {/if}

  {:else}
    <!-- DAY VIEW -->

    <!-- Week strip -->
    <div class="bg-card border border-border rounded-xl mb-6 overflow-hidden">
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
                    {#if visit.technician_name}<p class="text-xs text-muted mt-0.5">👤 {visit.technician_name}</p>{/if}
                    {#if visit.scheduled_time}<p class="text-xs text-muted mt-1">{formatTime(visit.scheduled_time)}</p>{/if}
                  </div>
                  <div class="flex flex-col items-end gap-1 flex-shrink-0">
                    <span class="text-xs px-2 py-0.5 rounded-full border capitalize {statusColors[visit.status]}">
                      {visit.status.replace('_', ' ')}
                    </span>
                    {#if visit.invoices?.[0]}
                      <span class="text-xs px-2 py-0.5 rounded-full border capitalize
                        {visit.invoices[0].status === 'paid' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-200'}">
                        $ {visit.invoices[0].status}
                      </span>
                    {/if}
                  </div>
                </div>
              </a>
            {:else}
              <div class="px-4 py-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-text truncate">{visit.properties?.customers?.name ?? '—'}</p>
                    <p class="text-xs text-muted mt-0.5 truncate">{visit.properties?.address}{#if visit.properties?.suburb}, {visit.properties.suburb}{/if}</p>
                    {#if visit.service_plans}<p class="text-xs text-primary mt-0.5">{formatRecurrence(visit.service_plans)}</p>{/if}
                    {#if visit.technician_name}<p class="text-xs text-muted mt-0.5">👤 {visit.technician_name}</p>{/if}
                    {#if visit.scheduled_time}<p class="text-xs text-muted mt-1">{formatTime(visit.scheduled_time)}</p>{/if}
                  </div>
                  <div class="flex flex-col items-end gap-1 flex-shrink-0">
                    <span class="text-xs px-2 py-0.5 rounded-full border capitalize {statusColors[visit.status]}">
                      {visit.status.replace('_', ' ')}
                    </span>
                    {#if visit.invoices?.[0]}
                      <span class="text-xs px-2 py-0.5 rounded-full border capitalize
                        {visit.invoices[0].status === 'paid' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-200'}">
                        $ {visit.invoices[0].status}
                      </span>
                    {/if}
                  </div>
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
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-text truncate">{visit.properties?.customers?.name ?? '—'}</p>
                <p class="text-xs text-muted truncate">{visit.properties?.address}</p>
                {#if visit.technician_name}<p class="text-xs text-muted mt-0.5">👤 {visit.technician_name}</p>{/if}
                <p class="text-xs text-danger mt-0.5">
                  {new Date(visit.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {#if visit.skip_reason}· {visit.skip_reason}{/if}
                </p>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <span class="text-xs px-2 py-0.5 rounded-full border capitalize {statusColors[visit.status]}">
                  {visit.status}
                </span>
                <form method="POST" action="?/moveToDay" use:enhance={() => {
    return async ({ update }) => { await update() }
  }}>
    <input type="hidden" name="visitId" value={visit.id} />
    <input type="hidden" name="targetDate" value={selectedDate} />
    <input type="hidden" name="oldDate" value={visit.scheduled_date} />
    <button type="submit"
      class="px-2 py-1 text-xs text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
      title="Move to {selectedDate}">
      → {selectedDate === today ? 'Today' : selectedDate}
    </button>
  </form>
                <form method="POST" action="?/cancelVisit" use:enhance={() => {
                  return async ({ update }) => { await update() }
                }}>
                  <input type="hidden" name="visitId" value={visit.id} />
                  <button type="submit"
                    class="p-1.5 text-muted hover:text-danger border border-border rounded-lg hover:bg-red-50 transition-colors"
                    title="Cancel visit">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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