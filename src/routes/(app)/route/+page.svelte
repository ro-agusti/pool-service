<script lang="ts">
  import { enhance } from '$app/forms'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { visits, route, routeVisits, selectedDate, today, googleMapsKey, backlog } = $derived(data)

  let map: any = null
  let markers: any[] = []
  let mapEl: HTMLDivElement
  let originInputEl: HTMLInputElement

  let originLat = $state<number | null>(route?.origin_lat ?? null)
  let originLng = $state<number | null>(route?.origin_lng ?? null)
  let originLabel = $state('')
  let gettingLocation = $state(false)

  // AI
  let loadingAI = $state(false)
  let suggestion = $state<any>(null)
  let aiError = $state('')

  const statusColors: Record<string, string> = {
    pending:     '#0EA5E9',
    in_progress: '#F59E0B',
    completed:   '#22C55E',
    skipped:     '#94A3B8',
    cancelled:   '#EF4444',
  }

  let orderedVisits = $derived(
    routeVisits.length
      ? routeVisits
      : visits.map((v: any, i: number) => ({
          visit_id: v.id,
          position: i + 1,
          visits: v,
          estimated_arrival: v.scheduled_time?.slice(0, 5) ?? null,
          estimated_travel_mins: null
        }))
  )

  function getVisit(rv: any): any {
    return rv.visits ?? null
  }

  function formatTime(t: string | null): string {
    if (!t) return ''
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    const ampm = h < 12 ? 'AM' : 'PM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  function formatDate(dateStr: string): string {
    if (dateStr === today) return 'Today'
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow'
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function openGoogleMaps(lat: number, lng: number, address: string) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_name=${encodeURIComponent(address)}&travelmode=driving`
    window.open(url, '_blank')
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return
    gettingLocation = true
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        originLat = pos.coords.latitude
        originLng = pos.coords.longitude
        originLabel = 'Current location'
        if (originInputEl) originInputEl.value = 'Current location'
        sessionStorage.setItem('route_origin', JSON.stringify({ lat: originLat, lng: originLng, label: originLabel }))
        gettingLocation = false
        updateMarkers()
      },
      () => { gettingLocation = false }
    )
  }

  async function getAISuggestion() {
    loadingAI = true
    aiError = ''
    suggestion = null

    const now = new Date()
    const currentTime = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

    const visitsPayload = orderedVisits.map((rv: any) => {
      const v = getVisit(rv)
      return {
        id: v?.id ?? rv.visit_id,
        address: v?.properties?.address ?? '',
        suburb: v?.properties?.suburb ?? '',
        customerName: v?.properties?.customers?.name ?? '',
        status: v?.status ?? '',
        estimatedArrival: rv.estimated_arrival,
        lat: v?.properties?.lat,
        lng: v?.properties?.lng
      }
    })

    const todayDate = new Date(selectedDate + 'T00:00:00')
    const backlogPayload = (backlog ?? []).map((v: any) => {
      const visitDate = new Date(v.scheduled_date + 'T00:00:00')
      const daysOverdue = Math.floor((todayDate.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24))
      return {
        id: v.id,
        address: v.properties?.address ?? '',
        suburb: v.properties?.suburb ?? '',
        customerName: v.properties?.customers?.name ?? '',
        daysOverdue,
        lat: v.properties?.lat,
        lng: v.properties?.lng
      }
    })

    try {
      const res = await fetch('/api/ai-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentLat: originLat,
          currentLng: originLng,
          visits: visitsPayload,
          backlog: backlogPayload,
          currentTime
        })
      })
      suggestion = await res.json()
    } catch {
      aiError = 'Could not get suggestion. Try again.'
    } finally {
      loadingAI = false
    }
  }

  onMount(() => {
    const saved = sessionStorage.getItem('route_origin')
    if (saved) {
      const { lat, lng, label } = JSON.parse(saved)
      originLat = lat
      originLng = lng
      originLabel = label
      if (originInputEl) originInputEl.value = label
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places&callback=initMap`
    script.async = true
    script.defer = true
    ;(window as any).initMap = initMap
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

    if (originInputEl) {
      const autocomplete = new (window as any).google.maps.places.Autocomplete(originInputEl, {
        componentRestrictions: { country: 'au' },
        fields: ['geometry', 'formatted_address']
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (place.geometry) {
          originLat = place.geometry.location.lat()
          originLng = place.geometry.location.lng()
          originLabel = place.formatted_address
          sessionStorage.setItem('route_origin', JSON.stringify({ lat: originLat, lng: originLng, label: originLabel }))
          updateMarkers()
        }
      })
    }

    updateMarkers()
  }

  function updateMarkers() {
    if (!map) return
    markers.forEach(m => m.setMap(null))
    markers = []

    const bounds = new (window as any).google.maps.LatLngBounds()

    if (originLat && originLng) {
      const originMarker = new (window as any).google.maps.Marker({
        position: { lat: originLat, lng: originLng },
        map,
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#1e293b',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        },
        title: 'Starting point'
      })
      markers.push(originMarker)
      bounds.extend({ lat: originLat, lng: originLng })
    }

    const visitsToShow = orderedVisits.filter((rv: any) => {
      const v = rv.visits
      return v?.properties?.lat && v?.properties?.lng
    })

    visitsToShow.forEach((rv: any, i: number) => {
      const visit = rv.visits
      const pos = { lat: visit.properties.lat, lng: visit.properties.lng }

      const marker = new (window as any).google.maps.Marker({
        position: pos,
        map,
        label: { text: String(i + 1), color: 'white', fontSize: '12px', fontWeight: 'bold' },
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 18,
          fillColor: statusColors[visit.status] ?? '#0EA5E9',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        },
        title: visit.properties.customers?.name
      })

      const infoWindow = new (window as any).google.maps.InfoWindow({
        content: `<div style="font-family:sans-serif;padding:4px;min-width:150px">
          <p style="font-weight:600;margin:0 0 2px">${visit.properties.customers?.name ?? ''}</p>
          <p style="color:#64748b;font-size:12px;margin:0">${visit.properties.address}</p>
        </div>`
      })

      marker.addListener('click', () => infoWindow.open(map, marker))
      markers.push(marker)
      bounds.extend(pos)
    })

    if (visitsToShow.length > 0 || (originLat && originLng)) map.fitBounds(bounds)
  }

  $effect(() => {
    if (map && orderedVisits) updateMarkers()
  })

  $effect(() => {
    if (map && (originLat || originLng)) updateMarkers()
  })

  function handleSubmit(e: SubmitEvent) {
    const form = e.target as HTMLFormElement
    const latInput = form.querySelector('input[name="originLat"]') as HTMLInputElement
    const lngInput = form.querySelector('input[name="originLng"]') as HTMLInputElement
    if (latInput) latInput.value = String(originLat ?? '')
    if (lngInput) lngInput.value = String(originLng ?? '')
  }
</script>

<div class="max-w-2xl">
  <!-- Header -->
  <div class="mb-4">
    <h1 class="text-2xl font-semibold text-text">Route</h1>
    <p class="text-sm text-muted">
      {formatDate(selectedDate)} · {visits.length} stop{visits.length !== 1 ? 's' : ''}
    </p>
  </div>

  <!-- Origin input -->
  <div class="bg-card border border-border rounded-xl p-4 mb-4">
    <p class="text-sm font-medium text-text mb-2">Starting from</p>
    <div class="flex gap-2">
      <input bind:this={originInputEl} type="text" placeholder="Enter starting address..."
        class="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
               focus:outline-none focus:ring-2 focus:ring-primary" />
      <button type="button" onclick={useCurrentLocation} disabled={gettingLocation}
        class="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-muted
               hover:bg-surface transition-colors disabled:opacity-50 flex-shrink-0">
        {#if gettingLocation}
          <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>
        {/if}
        My location
      </button>
    </div>
    {#if originLat && originLabel}
      <p class="text-xs text-muted mt-1.5">📍 {originLabel === 'Current location' ? 'Location detected' : originLabel}</p>
    {/if}
  </div>

  <!-- Map -->
  <div bind:this={mapEl} class="w-full h-64 rounded-xl border border-border mb-4 bg-surface"></div>

  <!-- AI suggestion button -->
  {#if visits.length > 0}
    <div class="mb-4">
      <button type="button" onclick={getAISuggestion} disabled={loadingAI}
        class="w-full py-2.5 flex items-center justify-center gap-2 bg-slate-900 text-white text-sm font-medium rounded-xl
               hover:bg-slate-800 transition-colors disabled:opacity-50">
        {#if loadingAI}
          <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          Thinking…
        {:else}
          ✨ What should I do next?
        {/if}
      </button>

      {#if aiError}
        <p class="text-xs text-muted mt-2 text-center">{aiError}</p>
      {/if}

      {#if suggestion}
        <div class="mt-3 bg-slate-900 text-white rounded-xl p-4">
          <p class="text-sm font-medium mb-1">{suggestion.suggestion}</p>
          {#if suggestion.reason}
            <p class="text-xs text-slate-400 mb-3">{suggestion.reason}</p>
          {/if}
          <div class="flex gap-2">
            {#if suggestion.lat && suggestion.lng}
              <button type="button"
                onclick={() => openGoogleMaps(suggestion.lat, suggestion.lng, suggestion.address)}
                class="flex-1 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark transition-colors">
                Navigate →
              </button>
            {/if}
            {#if suggestion.visitId}
              <a href="/visits/{suggestion.visitId}?from=route"
                class="flex-1 py-2 bg-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/20 transition-colors text-center">
                Open visit
              </a>
            {/if}
            <button type="button" onclick={() => suggestion = null}
              class="py-2 px-3 bg-white/10 text-white text-xs rounded-lg hover:bg-white/20 transition-colors">
              ✕
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Optimize button -->
  {#if visits.length >= 1}
    <form method="POST" action="?/optimizeRoute" class="mb-4" onsubmit={handleSubmit}>
      <input type="hidden" name="date" value={selectedDate} />
      <input type="hidden" name="visitIds" value={JSON.stringify(visits.map((v: any) => v.id))} />
      <input type="hidden" name="originLat" value="" />
      <input type="hidden" name="originLng" value="" />
      <button type="submit"
        class="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors">
        ✦ Optimize route
      </button>
    </form>
  {/if}

  {#if route?.optimized_at}
    <p class="text-xs text-muted mb-3">
      Optimized at {new Date(route.optimized_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
    </p>
  {/if}

  <a href="/route/nearby-visits?date={selectedDate}"
  class="w-full mb-4 py-2.5 flex items-center justify-center gap-2 border border-border bg-card text-sm font-medium text-text rounded-xl hover:bg-surface transition-colors">
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  Find nearby visits
</a>
  <!-- Visit list -->
  {#if orderedVisits.length === 0}
    <div class="bg-card border border-border rounded-xl p-10 text-center text-muted text-sm">
      No visits scheduled for this day
    </div>
  {:else}
    <div class="space-y-2">
      {#each orderedVisits as rv, i}
        {@const visit = getVisit(rv)}
        {#if visit}
          <div class="bg-card border border-border rounded-xl px-4 py-3">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                style="background-color: {statusColors[visit.status] ?? '#0EA5E9'}">
                {i + 1}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-text truncate">{visit.properties?.customers?.name ?? '—'}</p>
                <p class="text-xs text-muted truncate">{visit.properties?.address}{#if visit.properties?.suburb}, {visit.properties.suburb}{/if}</p>
                <div class="flex items-center gap-2 mt-0.5">
                  {#if rv.estimated_arrival}
                    <span class="text-xs text-primary font-medium">{formatTime(rv.estimated_arrival)}</span>
                  {/if}
                  {#if rv.estimated_travel_mins}
                    <span class="text-xs text-muted">· {rv.estimated_travel_mins} min drive</span>
                  {/if}
                </div>
              </div>
              <span class="text-xs px-2 py-0.5 rounded-full border flex-shrink-0 capitalize
                {visit.status === 'completed' ? 'bg-green-50 text-green-600 border-green-200' :
                 visit.status === 'in_progress' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                 visit.status === 'skipped' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                 'bg-blue-50 text-blue-600 border-blue-200'}">
                {visit.status.replace('_', ' ')}
              </span>
            </div>

            <div class="flex gap-2 pt-2 border-t border-border">
              {#if visit.status === 'pending' || visit.status === 'skipped'}
                <form method="POST" action="/api/visits/start" class="flex-1">
                  <input type="hidden" name="visitId" value={visit.id ?? rv.visit_id} />
                  <input type="hidden" name="oldStatus" value={visit.status} />
                  <input type="hidden" name="fromRoute" value="true" />
                  <button type="submit"
                    class="w-full py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark transition-colors">
                    Start visit
                  </button>
                </form>
              {:else if visit.status === 'in_progress'}
                <a href="/visits/{visit.id ?? rv.visit_id}?from=route"
                  class="flex-1 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors text-center">
                  Continue visit →
                </a>
              {:else if visit.status === 'completed'}
                <a href="/visits/{visit.id ?? rv.visit_id}?from=route"
                  class="flex-1 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg border border-green-200 hover:bg-green-100 transition-colors text-center">
                  View checklist
                </a>
              {/if}
              {#if visit.properties?.lat && visit.properties?.lng}
                <button type="button"
                  onclick={() => openGoogleMaps(visit.properties.lat, visit.properties.lng, visit.properties.address)}
                  class="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors flex-shrink-0"
                  title="Navigate">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                </button>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>