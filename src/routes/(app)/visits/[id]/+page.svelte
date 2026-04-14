<script lang="ts">
  import { enhance } from '$app/forms'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { visit, checklist, lastVisit, visitHistory, productMap, hasChecklist, existingInvoice } = $derived(data)

  let showSkip = $state(false)
  let skipReason = $state('')
  let fromRoute = $state(false)
  let fromCustomerResolved = $state<string | null>(null)

  onMount(() => {
    const from = data.fromRoute ? 'route' : data.fromCustomer ? `customer:${data.fromCustomer}` : null
    if (from) sessionStorage.setItem(`visit_origin_${visit.id}`, from)
    const saved = sessionStorage.getItem(`visit_origin_${visit.id}`)
    if (saved === 'route') fromRoute = true
    else if (saved?.startsWith('customer:')) fromCustomerResolved = saved.replace('customer:', '')
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

  function formatDateShort(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short'
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

  let backHref = $derived(
    fromRoute ? '/route' :
    fromCustomerResolved
      ? `/customers/${visit.properties?.customers?.id}/properties/${fromCustomerResolved}`
      : '/visits'
  )
  let backLabel = $derived(
    fromRoute ? '← Route' :
    fromCustomerResolved ? '← Property' :
    '← Visits'
  )

  // ─── Water test parameters with ranges ───
  const waterParams = [
    { key: 'ph',               label: 'pH',          unit: '',    min: 7.2,  max: 7.6 },
    { key: 'chlorine',         label: 'Chlorine',    unit: 'ppm', min: 1,    max: 3 },
    { key: 'alkalinity',       label: 'Alkalinity',  unit: 'ppm', min: 80,   max: 120 },
    { key: 'stabiliser',       label: 'Stabiliser',  unit: 'ppm', min: 30,   max: 50 },
    { key: 'salt',             label: 'Salt',        unit: 'ppm', min: 3000, max: 4500 },
    { key: 'calcium_hardness', label: 'Calcium',     unit: 'ppm', min: 200,  max: 400 },
  ]

  function getStatus(val: number | null, min: number, max: number): 'ok' | 'low' | 'high' | 'empty' {
    if (val == null) return 'empty'
    if (val < min) return 'low'
    if (val > max) return 'high'
    return 'ok'
  }

  // ─── Trend chart helpers ───
  // Build timeline: [oldest history...history, current visit] in chronological order
  let trendPoints = $derived(
    !checklist || !visitHistory
      ? []
      : [
          ...[...visitHistory].reverse().map((v: any) => ({
            date: v.scheduled_date,
            cl: v.visit_checklists?.[0] ?? null,
            isCurrent: false,
          })),
          { date: visit.scheduled_date, cl: checklist, isCurrent: true },
        ]
  )

  // For a given metric, build chart path data (SVG)
  function buildSparkline(
    points: typeof trendPoints,
    key: string,
    width: number,
    height: number
  ): { path: string; dots: Array<{ x: number; y: number; val: number | null; isCurrent: boolean }> } {
    const vals = points.map((p) => (p.cl ? (p.cl as any)[key] : null) as number | null)
    const defined = vals.filter((v) => v != null) as number[]
    if (defined.length < 2) return { path: '', dots: [] }

    const minV = Math.min(...defined)
    const maxV = Math.max(...defined)
    const range = maxV - minV || 1
    const pad = 8

    const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (width - pad * 2))
    const ys = vals.map((v) =>
      v != null ? height - pad - ((v - minV) / range) * (height - pad * 2) : null
    )

    const pathParts: string[] = []
    let started = false
    for (let i = 0; i < xs.length; i++) {
      if (ys[i] == null) { started = false; continue }
      pathParts.push(started ? `L ${xs[i].toFixed(1)} ${ys[i]!.toFixed(1)}` : `M ${xs[i].toFixed(1)} ${ys[i]!.toFixed(1)}`)
      started = true
    }

    const dots = points.map((p, i) => ({
      x: xs[i],
      y: ys[i] ?? 0,
      val: vals[i],
      isCurrent: p.isCurrent,
    })).filter((d) => d.val != null)

    return { path: pathParts.join(' '), dots }
  }

  // Which params have enough data to show a trend (≥2 points with values)
  let trendableParams = $derived(
    trendPoints.length < 2
      ? []
      : waterParams.filter((p) => {
          const vals = trendPoints.map((tp) => (tp.cl ? (tp.cl as any)[p.key] : null))
          return vals.filter((v) => v != null).length >= 2
        })
  )

  type TrendAlert = { label: string; direction: 'high' | 'low'; count: number }
  let trendAlerts = $derived(
    trendPoints.length < 2
      ? ([] as TrendAlert[])
      : waterParams.reduce((alerts: TrendAlert[], p) => {
          const recent = trendPoints.slice(-3)
          const statuses = recent.map((tp) => getStatus((tp.cl as any)?.[p.key] ?? null, p.min, p.max))
          const highCount = statuses.filter((s) => s === 'high').length
          const lowCount  = statuses.filter((s) => s === 'low').length
          if (highCount >= 2 && statuses[statuses.length - 1] === 'high') {
            alerts.push({ label: p.label, direction: 'high', count: highCount })
          } else if (lowCount >= 2 && statuses[statuses.length - 1] === 'low') {
            alerts.push({ label: p.label, direction: 'low', count: lowCount })
          }
          return alerts
        }, [])
  )

  // SVG chart dimensions
  const CHART_W = 280
  const CHART_H = 64
</script>

<div class="max-w-2xl">
  <!-- Header -->
  <div class="mb-4">
    <div class="flex items-center gap-3 mb-2">
      <a href={backHref} class="text-sm text-muted hover:text-text transition-colors">{backLabel}</a>
    </div>
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-xl font-semibold text-text">{visit.properties?.customers?.name ?? '—'}</h1>
        <p class="text-sm text-muted mt-0.5">
          {visit.properties?.address}{#if visit.properties?.suburb}, {visit.properties.suburb}{/if}
        </p>
        {#if visit.service_plans}
          <p class="text-xs text-primary mt-0.5">{formatRecurrence(visit.service_plans)}</p>
        {/if}
        {#if visit.scheduled_time}
          <p class="text-xs text-muted mt-0.5">{formatTime(visit.scheduled_time)}</p>
        {/if}
      </div>
      <span class="text-xs px-2 py-1 rounded-full border capitalize flex-shrink-0
        {visit.status === 'in_progress' ? 'bg-amber-50 text-amber-600 border-amber-200' :
         visit.status === 'completed'   ? 'bg-green-50 text-green-600 border-green-200' :
         visit.status === 'skipped'     ? 'bg-slate-100 text-slate-500 border-slate-200' :
         'bg-blue-50 text-blue-600 border-blue-200'}">
        {visit.status.replace('_', ' ')}
      </span>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════ -->
  <!-- COMPLETED SUMMARY (shown when visit is done and has checklist) -->
  <!-- ═══════════════════════════════════════════ -->
  {#if visit.status === 'completed' && checklist}

    <!-- Water test grid -->
    <p class="text-xs font-medium text-muted uppercase tracking-wider mb-2">Water analysis</p>
    <div class="grid grid-cols-3 gap-2 mb-4">
      {#each waterParams as param}
        {@const val = (checklist as any)[param.key]}
        {@const status = getStatus(val, param.min, param.max)}
        {#if val != null}
          <div class="bg-surface rounded-xl p-3">
            <p class="text-xs text-muted mb-1">{param.label}</p>
            <p class="text-lg font-semibold leading-none
              {status === 'ok' ? 'text-green-600' :
               status === 'low' || status === 'high' ? 'text-amber-600' : 'text-text'}">
              {val}<span class="text-xs font-normal text-muted ml-0.5">{param.unit}</span>
            </p>
          </div>
        {/if}
      {/each}
    </div>

    <!-- Trend chart (only if ≥1 previous completed visit with water data) -->
    {#if trendPoints.length >= 2 && trendableParams.length > 0}
      <div class="bg-card border border-border rounded-xl p-4 mb-4">
        <p class="text-xs font-medium text-muted uppercase tracking-wider mb-3">Trend — last {trendPoints.length} visits</p>

        <!-- Alerts -->
        {#each trendAlerts as alert}
          <div class="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3 text-xs text-amber-700">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></span>
            {alert.label} {alert.direction === 'high' ? 'elevated' : 'low'} for {alert.count} consecutive visits
          </div>
        {/each}

        <!-- Date labels row -->
        <div class="flex mb-1" style="padding: 0 0px;">
          {#each trendPoints as tp}
            <div class="flex-1 text-center">
              <span class="text-[10px] {tp.isCurrent ? 'text-primary font-medium' : 'text-muted'}">
                {tp.isCurrent ? 'Today' : formatDateShort(tp.date)}
              </span>
            </div>
          {/each}
        </div>

        <!-- One sparkline per trendable param -->
        <div class="space-y-3">
          {#each trendableParams as param}
            {@const spark = buildSparkline(trendPoints, param.key, CHART_W, CHART_H)}
            {#if spark.path}
              <div>
                <p class="text-xs text-muted mb-1">{param.label}{param.unit ? ` (${param.unit})` : ''}</p>
                <div class="overflow-hidden rounded-lg bg-surface" style="height: {CHART_H}px;">
                  <svg viewBox="0 0 {CHART_W} {CHART_H}" width="100%" height={CHART_H} preserveAspectRatio="none">
                    <!-- Range band -->
                    <rect
                      x="0" y="0" width={CHART_W} height={CHART_H}
                      fill="transparent"
                    />
                    <!-- Line -->
                    <path
                      d={spark.path}
                      fill="none"
                      stroke="#94a3b8"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <!-- Dots -->
                    {#each spark.dots as dot}
                      {@const s = getStatus(dot.val, param.min, param.max)}
                      <circle
                        cx={dot.x}
                        cy={dot.y}
                        r={dot.isCurrent ? 4 : 3}
                        fill={dot.isCurrent ? '#0EA5E9' : (s === 'ok' ? '#22c55e' : '#f59e0b')}
                        stroke="white"
                        stroke-width="1.5"
                      />
                      <!-- Value label on current dot -->
                      {#if dot.isCurrent}
                        <text
                          x={dot.x}
                          y={dot.y - 8}
                          text-anchor="middle"
                          font-size="9"
                          font-weight="600"
                          fill="#0EA5E9"
                        >{dot.val}</text>
                      {/if}
                    {/each}
                  </svg>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Tasks completed -->
    {#if checklist.tasks_completed?.length > 0}
      <p class="text-xs font-medium text-muted uppercase tracking-wider mb-2">Tasks completed</p>
      <div class="bg-card border border-border rounded-xl divide-y divide-border mb-4">
        {#each checklist.tasks_completed as taskId}
          <div class="px-4 py-3 flex items-center gap-3">
            <span class="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
            <span class="text-sm text-text">{productMap?.[taskId] ?? taskId}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Chemicals added -->
    {#if checklist.chemicals_added?.length > 0}
      <p class="text-xs font-medium text-muted uppercase tracking-wider mb-2">Chemicals added</p>
      <div class="bg-card border border-border rounded-xl divide-y divide-border mb-4">
        {#each checklist.chemicals_added as chem}
          <div class="px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-text">{chem.name}</span>
            <span class="text-sm text-muted">{chem.amount} {chem.unit}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Notes -->
    {#if checklist.notes}
      <p class="text-xs font-medium text-muted uppercase tracking-wider mb-2">Notes</p>
      <div class="bg-card border border-border rounded-xl px-4 py-3 mb-4">
        <p class="text-sm text-text">{checklist.notes}</p>
      </div>
    {/if}

    <!-- Photos -->
    {#if checklist.photos?.length > 0}
      <p class="text-xs font-medium text-muted uppercase tracking-wider mb-2">Photos</p>
      <div class="grid grid-cols-3 gap-2 mb-4">
        {#each checklist.photos as url}
          <a href={url} target="_blank" class="aspect-square">
            <img src={url} alt="Visit photo" class="w-full h-full object-cover rounded-xl" />
          </a>
        {/each}
      </div>
    {/if}

    <!-- Edit checklist (small) -->
    <a
      href="/visits/{visit.id}/checklist{fromRoute ? '?from=route' : ''}"
      class="inline-flex items-center gap-1.5 text-xs text-muted border border-border rounded-lg px-3 py-1.5 hover:bg-surface transition-colors mb-4"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Edit checklist
    </a>

    <!-- Divider before the rest -->
    <div class="border-t border-border mb-4"></div>

  {:else if visit.status === 'in_progress' || visit.status === 'completed'}
    <!-- Last visit banner (only shown when no checklist summary above) -->
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
    <div class="bg-card border border-border rounded-xl divide-y divide-border mb-4">
      {#if visit.properties.customers.phone}
        <a href="tel:{visit.properties.customers.phone}" class="px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.64 3.43 2 2 0 0 1 3.6 1.25h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span class="text-sm text-text">{visit.properties.customers.phone}</span>
        </a>
      {/if}
      {#if visit.properties.customers.email}
        <a href="/cdn-cgi/l/email-protection#176c617e647e6339676578677265637e72643974626463787a72656439727a767e7b6a" class="px-4 py-3 flex items-center gap-3 hover:bg-surface transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span class="text-sm text-text">{visit.properties.customers.email}</span>
        </a>
      {/if}
    </div>
  {/if}

  <!-- Invoice button -->
  <div class="mb-4">
    {#if existingInvoice}
      <a href="/visits/{visit.id}/invoice"
        class="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 hover:bg-surface transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div>
            <span class="text-sm font-medium text-text">View invoice</span>
            <p class="text-xs text-muted capitalize">{existingInvoice.status}</p>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </a>
    {:else if visit.status === 'completed' && hasChecklist}
      <a href="/visits/{visit.id}/invoice"
        class="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 hover:bg-surface transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <span class="text-sm font-medium text-text">Create invoice</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </a>
    {:else}
      <div class="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 opacity-50">
        <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div>
          <span class="text-sm font-medium text-text">Create invoice</span>
          <p class="text-xs text-muted">
            {#if visit.status !== 'completed'}Complete the visit first{:else}Fill the checklist first{/if}
          </p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Actions — in_progress only -->
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

  <!-- Completed — back to route link -->
  {#if visit.status === 'completed' && fromRoute}
    <a href="/route"
      class="flex items-center justify-center gap-2 w-full py-3 border border-border rounded-xl text-sm font-medium text-text hover:bg-surface transition-colors mt-2">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      Back to route
    </a>
  {/if}
</div>