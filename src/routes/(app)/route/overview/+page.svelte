<script lang="ts">
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { visits, technicians, selectedDate, today, weekDates, googleMapsKey } = $derived(data)

  let map: any = null
  let mapEl: HTMLDivElement

  // Assign a color to each technician
  const techColors = [
    '#0EA5E9', // sky-500
    '#8B5CF6', // violet-500
    '#F59E0B', // amber-500
    '#22C55E', // green-500
    '#EF4444', // red-500
    '#EC4899', // pink-500
    '#14B8A6', // teal-500
    '#F97316', // orange-500
  ]

  let techColorMap = $derived(
    Object.fromEntries(
      technicians.map((t: any, i: number) => [t.id, techColors[i % techColors.length]])
    )
  )

  function formatDate(dateStr: string): string {
    if (dateStr === today) return 'Today'
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow'
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function changeWeek(offset: number) {
    const [y, m, d] = selectedDate.split('-').map(Number)
    const months = [0,31,28,31,30,31,30,31,31,30,31,30,31]
    const isLeap = (yr: number) => yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)
    let cy = y, cm = m, cd = d + offset * 7
    while (cd < 1) { cm--; if (cm < 1) { cm = 12; cy-- } cd += months[cm] + (cm === 2 && isLeap(cy) ? 1 : 0) }
    while (true) { const dim = months[cm] + (cm === 2 && isLeap(cy) ? 1 : 0); if (cd <= dim) break; cd -= dim; cm++; if (cm > 12) { cm = 1; cy++ } }
    const newDate = `${cy}-${String(cm).padStart(2,'0')}-${String(cd).padStart(2,'0')}`
    window.location.href = `/route/overview?date=${newDate}`
  }

  onMount(() => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&callback=initOverviewMap`
    script.async = true
    script.defer = true
    ;(window as any).initOverviewMap = initMap
    document.head.appendChild(script)
  })

  function initMap() {
    if (!mapEl) return

    map = new (window as any).google.maps.Map(mapEl, {
      zoom: 11,
      center: { lat: -26.65, lng: 153.09 },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
      ]
    })

    const bounds = new (window as any).google.maps.LatLngBounds()

    visits.forEach((v: any) => {
      const pos = { lat: v.properties.lat, lng: v.properties.lng }
      const color = techColorMap[v.technician_id] ?? '#94A3B8'

      const marker = new (window as any).google.maps.Marker({
        position: pos,
        map,
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        },
        title: v.properties.customers?.name
      })

      const iw = new (window as any).google.maps.InfoWindow({
        content: `<div style="font-family:sans-serif;padding:4px;min-width:160px">
          <p style="font-weight:600;margin:0 0 2px;font-size:13px">${v.properties.customers?.name ?? ''}</p>
          <p style="color:#64748b;font-size:11px;margin:0 0 2px">${v.properties.address}</p>
          <p style="color:${color};font-size:11px;margin:0;font-weight:600">👤 ${v.technician_name}</p>
        </div>`
      })

      marker.addListener('click', () => iw.open(map, marker))
      bounds.extend(pos)
    })

    if (visits.length > 0) map.fitBounds(bounds)
  }
</script>

<div class="max-w-2xl">
  <!-- Header -->
  <div class="mb-4">
    <a href="/route?date={selectedDate}" class="text-sm text-muted hover:text-text transition-colors">← My route</a>
    <div class="flex items-center justify-between mt-2">
      <div>
        <h1 class="text-xl font-semibold text-text">Team overview</h1>
        <p class="text-sm text-muted">{formatDate(selectedDate)} · {visits.length} visit{visits.length !== 1 ? 's' : ''} across {technicians.length} technician{technicians.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  </div>

  <!-- Week strip -->
  <div class="bg-card border border-border rounded-xl mb-4 overflow-hidden">
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
        {@const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']}
        <a href="/route/overview?date={wd.date}"
          class="flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors
            {wd.date === selectedDate ? 'bg-primary' : 'hover:bg-surface'}">
          <span class="text-xs {wd.date === selectedDate ? 'text-white' : 'text-muted'}">{days[i]}</span>
          <span class="text-sm font-medium {wd.date === selectedDate ? 'text-white' : wd.date === today ? 'text-primary' : 'text-text'}">
            {Number(wd.date.split('-')[2])}
          </span>
          <span class="w-1 h-1 rounded-full {wd.hasVisits ? (wd.date === selectedDate ? 'bg-white' : 'bg-primary') : 'bg-transparent'}"></span>
        </a>
      {/each}
    </div>
  </div>

  <!-- Legend -->
  {#if technicians.length > 0}
    <div class="bg-card border border-border rounded-xl p-3 mb-4">
      <div class="flex flex-wrap gap-3">
        {#each technicians as tech, i}
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full flex-shrink-0"
              style="background-color: {techColors[i % techColors.length]}"></span>
            <span class="text-xs text-text">{tech.name}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Map -->
  <div bind:this={mapEl} class="w-full h-80 rounded-xl border border-border mb-4 bg-surface"></div>

  <!-- Visit list grouped by technician -->
  {#if visits.length === 0}
    <div class="bg-card border border-border rounded-xl p-8 text-center text-muted text-sm">
      No visits scheduled for this day
    </div>
  {:else}
    {#each technicians as tech, ti}
      {@const techVisits = visits.filter((v: any) => v.technician_id === tech.id)}
      {#if techVisits.length > 0}
        <div class="mb-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-3 h-3 rounded-full flex-shrink-0"
              style="background-color: {techColors[ti % techColors.length]}"></span>
            <p class="text-sm font-medium text-text">{tech.name}</p>
            <span class="text-xs text-muted">{techVisits.length} visit{techVisits.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="bg-card border border-border rounded-xl overflow-hidden">
            {#each techVisits as v, i}
              <a href="/visits/{v.id}"
                class="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors {i !== 0 ? 'border-t border-border' : ''}">
                <div class="w-2 h-2 rounded-full flex-shrink-0"
                  style="background-color: {techColors[ti % techColors.length]}"></div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-text truncate">{v.properties?.customers?.name ?? '—'}</p>
                  <p class="text-xs text-muted truncate">{v.properties?.address}{#if v.properties?.suburb}, {v.properties.suburb}{/if}</p>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full border flex-shrink-0 capitalize
                  {v.status === 'completed' ? 'bg-green-50 text-green-600 border-green-200' :
                   v.status === 'in_progress' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                   v.status === 'skipped' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                   'bg-blue-50 text-blue-600 border-blue-200'}">
                  {v.status.replace('_', ' ')}
                </span>
              </a>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  {/if}
</div>