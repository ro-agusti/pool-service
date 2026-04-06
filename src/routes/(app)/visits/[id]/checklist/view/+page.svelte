<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { visit, checklist } = $derived(data)

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  function formatTime(t: string | null): string {
    if (!t) return ''
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    const ampm = h < 12 ? 'AM' : 'PM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const waterParams = [
    { key: 'ph',               label: 'pH',               unit: '',    min: 7.2,  max: 7.6 },
    { key: 'chlorine',         label: 'Free chlorine',    unit: 'ppm', min: 1,    max: 3 },
    { key: 'alkalinity',       label: 'Alkalinity',       unit: 'ppm', min: 80,   max: 120 },
    { key: 'stabiliser',       label: 'Stabiliser (CYA)', unit: 'ppm', min: 30,   max: 50 },
    { key: 'salt',             label: 'Salt',             unit: 'ppm', min: 3000, max: 4500 },
    { key: 'calcium_hardness', label: 'Calcium hardness', unit: 'ppm', min: 200,  max: 400 },
  ]

  function getStatus(val: number | null, min: number, max: number) {
    if (val == null) return 'empty'
    if (val < min) return 'low'
    if (val > max) return 'high'
    return 'ok'
  }

  const statusStyle = {
    ok:    { badge: 'bg-green-100 text-green-700', text: 'OK' },
    low:   { badge: 'bg-amber-100 text-amber-700', text: 'Low' },
    high:  { badge: 'bg-red-100 text-red-700',     text: 'High' },
    empty: { badge: '',                             text: '' },
  }
</script>

<div class="max-w-2xl">
  <!-- Header -->
  <div class="mb-6">
    <button onclick={() => history.back()} class="text-sm text-muted hover:text-text transition-colors">← Back</button>
    <h1 class="text-xl font-semibold text-text mt-2">Last visit checklist</h1>
    <p class="text-sm text-muted">{formatDate(visit.scheduled_date)}{#if visit.scheduled_time} · {formatTime(visit.scheduled_time)}{/if}</p>
  </div>

  {#if !checklist}
    <div class="bg-card border border-border rounded-xl p-8 text-center text-muted text-sm">
      No checklist was recorded for this visit
    </div>
  {:else}
    <div class="space-y-3">

      <!-- Tasks -->
      <div class="bg-card border border-border rounded-xl divide-y divide-border">
        <div class="px-4 py-3 flex items-center justify-between">
          <span class="text-sm text-text">General clean</span>
          <span class="text-xs px-2 py-0.5 rounded-full {checklist.general_clean ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">
            {checklist.general_clean ? 'Done' : 'Not done'}
          </span>
        </div>
        <div class="px-4 py-3 flex items-center justify-between">
          <span class="text-sm text-text">SpinDisk water test</span>
          <span class="text-xs px-2 py-0.5 rounded-full {checklist.spin_filter ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">
            {checklist.spin_filter ? 'Done' : 'Not done'}
          </span>
        </div>
      </div>

      <!-- Water test -->
      <div class="bg-card border border-border rounded-xl overflow-hidden">
        <p class="text-sm font-medium text-text px-4 py-3 border-b border-border">Water test</p>
        <div class="divide-y divide-border">
          {#each waterParams as param}
            {@const val = checklist[param.key]}
            {@const status = getStatus(val, param.min, param.max)}
            {#if val != null}
              <div class="px-4 py-3 flex items-center justify-between">
                <span class="text-sm text-muted">{param.label}</span>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-text">{val}{param.unit ? ' ' + param.unit : ''}</span>
                  {#if status !== 'empty'}
                    <span class="text-xs px-2 py-0.5 rounded-full {statusStyle[status].badge}">
                      {statusStyle[status].text}
                    </span>
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <!-- Chemicals -->
      {#if checklist.chemicals_added?.length > 0}
        <div class="bg-card border border-border rounded-xl overflow-hidden">
          <p class="text-sm font-medium text-text px-4 py-3 border-b border-border">Chemicals added</p>
          <div class="divide-y divide-border">
            {#each checklist.chemicals_added as chem}
              <div class="px-4 py-3 flex items-center justify-between">
                <span class="text-sm text-text">{chem.name}</span>
                <span class="text-sm text-muted">{chem.amount} {chem.unit}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Photos -->
      {#if checklist.photos?.length > 0}
        <div class="bg-card border border-border rounded-xl p-4">
          <p class="text-sm font-medium text-text mb-3">Photos</p>
          <div class="grid grid-cols-3 gap-2">
            {#each checklist.photos as url}
              <a href={url} target="_blank" class="aspect-square">
                <img src={url} alt="Visit photo" class="w-full h-full object-cover rounded-lg" />
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Notes -->
      {#if checklist.notes}
        <div class="bg-card border border-border rounded-xl p-4">
          <p class="text-sm font-medium text-text mb-1">Notes</p>
          <p class="text-sm text-muted">{checklist.notes}</p>
        </div>
      {/if}

    </div>
  {/if}
</div>