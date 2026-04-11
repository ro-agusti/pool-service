<script lang="ts">
  import { enhance } from '$app/forms'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { selectedDate, today, todayVisits, nearbyVisits, centerLat, centerLng, googleMapsKey } = $derived(data)

  let map: any = null
  let mapEl: HTMLDivElement
  let selectedVisitId = $state<string | null>(null)

  const selectedVisit = $derived(nearbyVisits.find((v: any) => v.id === selectedVisitId) ?? null)

  function formatDate(dateStr: string): string {
    if (dateStr === today) return 'Today'
    const [y, m, d] = dateStr.split('-').map(Number)
    const [ty, tm, td] = today.split('-').map(Number)
    const diff = Math.round((new Date(y,m-1,d).getTime() - new Date(ty,tm-1,td).getTime()) / 86400000)
    if (diff === 1) return 'Tomorrow'
    return `In ${diff} days`
  }

  function formatDateFull(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short'
    })
  }

  onMount(() => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&callback=initNearbyMap`
    script.async = true
    script.defer = true
    ;(window as any).initNearbyMap = initMap
    document.head.appendChild(script)
  })

  function initMap() {
    if (!mapEl) return

    const center = centerLat && centerLng
      ? { lat: centerLat, lng: centerLng }
      : { lat: -26.65, lng: 153.09 }

    map = new (window as any).google.maps.Map(mapEl, {
      zoom: 11,
      center,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
      ]
    })

    const bounds = new (window as any).google.maps.LatLngBounds()

    // Visitas del día — grises
    todayVisits.forEach((v: any) => {
      const pos = { lat: v.properties.lat, lng: v.properties.lng }
      const marker = new (window as any).google.maps.Marker({
        position: pos,
        map,
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#94A3B8',
          fillOpacity: 0.8,
          strokeColor: 'white',
          strokeWeight: 2
        },
        title: v.properties.customers?.name
      })
      const iw = new (window as any).google.maps.InfoWindow({
        content: `<div style="font-family:sans-serif;padding:4px">
          <p style="font-weight:600;margin:0 0 2px;font-size:13px">${v.properties.customers?.name ?? ''}</p>
          <p style="color:#64748b;font-size:11px;margin:0">${v.properties.address}</p>
          <p style="color:#94a3b8;font-size:11px;margin:2px 0 0">Scheduled today</p>
        </div>`
      })
      marker.addListener('click', () => iw.open(map, marker))
      bounds.extend(pos)
    })

    // Visitas cercanas — sky-500 con número
    nearbyVisits.forEach((v: any, i: number) => {
      const pos = { lat: v.properties.lat, lng: v.properties.lng }
      const marker = new (window as any).google.maps.Marker({
        position: pos,
        map,
        label: { text: String(i + 1), color: 'white', fontSize: '12px', fontWeight: 'bold' },
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 18,
          fillColor: '#0EA5E9',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        },
        title: v.properties.customers?.name
      })

      // InfoWindow con botón de mover
      const iwContent = `
        <div style="font-family:sans-serif;padding:4px;min-width:180px">
          <p style="font-weight:600;margin:0 0 2px;font-size:13px">${v.properties.customers?.name ?? ''}</p>
          <p style="color:#64748b;font-size:11px;margin:0 0 4px">${v.properties.address}</p>
          <p style="color:#0EA5E9;font-size:11px;margin:0 0 8px">${formatDateFull(v.scheduled_date)}${v.distanceKm ? ' · ' + v.distanceKm + ' km' : ''}</p>
          <button onclick="window.moveVisit('${v.id}','${v.scheduled_date}')"
            style="width:100%;padding:6px;background:#0EA5E9;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">
            ✦ Add to today
          </button>
        </div>`

      const iw = new (window as any).google.maps.InfoWindow({ content: iwContent })

      marker.addListener('click', () => {
        iw.open(map, marker)
        selectedVisitId = v.id
      })

      bounds.extend(pos)
    })

    if (todayVisits.length > 0 || nearbyVisits.length > 0) map.fitBounds(bounds)

    // Global handler para el botón dentro del InfoWindow
    ;(window as any).moveVisit = (visitId: string, fromDate: string) => {
      selectedVisitId = visitId
      // Submit the hidden form
      const form = document.getElementById(`move-form-${visitId}`) as HTMLFormElement
      if (form) form.requestSubmit()
    }
  }
</script>

<div class="max-w-2xl">
  <!-- Header -->
  <div class="mb-4">
    <a href="/route?date={selectedDate}" class="text-sm text-muted hover:text-text transition-colors">← Route</a>
    <h1 class="text-xl font-semibold text-text mt-2">Nearby visits</h1>
    <p class="text-sm text-muted">Next 3 days within 20km of today's route</p>
  </div>

  <!-- Legend -->
  <div class="flex items-center gap-4 mb-3 px-1">
    <div class="flex items-center gap-1.5 text-xs text-muted">
      <span class="w-3 h-3 rounded-full bg-slate-400 inline-block"></span> Today's visits
    </div>
    <div class="flex items-center gap-1.5 text-xs text-muted">
      <span class="w-3 h-3 rounded-full bg-primary inline-block"></span> Nearby visits
    </div>
  </div>

  <!-- Map -->
  <div bind:this={mapEl} class="w-full h-72 rounded-xl border border-border mb-4 bg-surface"></div>

  <!-- Hidden forms for moving visits (triggered from map InfoWindow) -->
  {#each nearbyVisits as v}
    <form id="move-form-{v.id}" method="POST" action="?/moveToDay" use:enhance class="hidden">
      <input type="hidden" name="visitId" value={v.id} />
      <input type="hidden" name="toDate" value={selectedDate} />
      <input type="hidden" name="fromDate" value={v.scheduled_date} />
    </form>
  {/each}

  <!-- Nearby visits list -->
  {#if nearbyVisits.length === 0}
    <div class="bg-card border border-border rounded-xl p-8 text-center">
      <p class="text-sm font-medium text-text mb-1">No nearby visits found</p>
      <p class="text-xs text-muted">No pending visits within 20km in the next 3 days.</p>
    </div>
  {:else}
    <div class="space-y-2">
      {#each nearbyVisits as v, i}
        <div class="bg-card border border-border rounded-xl px-4 py-3
          {selectedVisitId === v.id ? 'ring-2 ring-primary' : ''}">
          <div class="flex items-center gap-3">
            <!-- Number badge -->
            <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span class="text-white text-sm font-bold">{i + 1}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text truncate">{v.properties?.customers?.name ?? '—'}</p>
              <p class="text-xs text-muted truncate">{v.properties?.address}{#if v.properties?.suburb}, {v.properties.suburb}{/if}</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs text-primary font-medium">{formatDate(v.scheduled_date)}</span>
                <span class="text-xs text-muted">· {formatDateFull(v.scheduled_date)}</span>
                {#if v.distanceKm !== null}
                  <span class="text-xs text-muted">· {v.distanceKm} km</span>
                {/if}
              </div>
            </div>
            <!-- Move button -->
            <form method="POST" action="?/moveToDay" use:enhance class="flex-shrink-0">
              <input type="hidden" name="visitId" value={v.id} />
              <input type="hidden" name="toDate" value={selectedDate} />
              <input type="hidden" name="fromDate" value={v.scheduled_date} />
              <button type="submit"
                class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark transition-colors"
                title="Add to today">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add to today
              </button>
            </form>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Today's visits (reference) -->
  {#if todayVisits.length > 0}
    <div class="mt-6">
      <h2 class="text-sm font-medium text-muted mb-2">Today's route ({todayVisits.length} visits)</h2>
      <div class="bg-card border border-border rounded-xl overflow-hidden">
        {#each todayVisits as v, i}
          <div class="px-4 py-2.5 flex items-center gap-3 {i !== 0 ? 'border-t border-border' : ''}">
            <span class="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0"></span>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-text truncate">{v.properties?.customers?.name ?? '—'}</p>
              <p class="text-xs text-muted truncate">{v.properties?.address}{#if v.properties?.suburb}, {v.properties.suburb}{/if}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>