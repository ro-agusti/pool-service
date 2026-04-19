<script lang="ts">
  import { enhance } from '$app/forms'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { properties, technicians, googleMapsKey } = $derived(data)

  let map: any = null
  let mapEl: HTMLDivElement
  let markers: any[] = []

  let selectedProperty = $state<any>(null)
  let reassigning = $state(false)
  let selectedTechId = $state<string>('')

  // AI recommendations state
  let loadingAI = $state(false)
  let recommendations = $state<any[]>([])
  let selectedRecs = $state<Set<string>>(new Set())
  let applyingRecs = $state(false)
  let showingRecs = $state(false)

  const techColors = [
    '#0EA5E9', '#8B5CF6', '#F59E0B', '#22C55E',
    '#EF4444', '#EC4899', '#14B8A6', '#F97316',
  ]

  let techColorMap = $derived(
    Object.fromEntries(
      technicians.map((t: any, i: number) => [t.id, techColors[i % techColors.length]])
    )
  )

  function getMarkerColor(p: any): string {
    if (showingRecs) {
      const rec = recommendations.find((r: any) => r.propertyId === p.id)
      if (rec) return techColorMap[rec.suggestedTechId] ?? '#94A3B8'
    }
    return p.technician_id ? (techColorMap[p.technician_id] ?? '#94A3B8') : '#94A3B8'
  }

  onMount(() => {
    ;(window as any).initCustomersMap = initMap
    if ((window as any).google?.maps) {
      initMap()
    } else {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&callback=initCustomersMap`
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
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
    updateMarkers()
  }

  function updateMarkers() {
    if (!map) return
    markers.forEach(m => m.setMap(null))
    markers = []
    const bounds = new (window as any).google.maps.LatLngBounds()
    properties.forEach((p: any) => {
      const pos = { lat: p.lat, lng: p.lng }
      const color = getMarkerColor(p)
      const marker = new (window as any).google.maps.Marker({
        position: pos,
        map,
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        },
        title: p.customers?.name
      })
      marker.addListener('click', () => {
        selectedProperty = p
        selectedTechId = p.technician_id ?? ''
      })
      bounds.extend(pos)
      markers.push(marker)
    })
    if (properties.length > 0) map.fitBounds(bounds)
  }

  $effect(() => {
    const _ = showingRecs
    const __ = recommendations.length
    if (map) updateMarkers()
  })

  async function getRecommendations() {
    loadingAI = true
    recommendations = []
    showingRecs = false
    try {
      const res = await fetch('/api/zone-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: properties.map((p: any) => ({
            id: p.id,
            address: p.address,
            suburb: p.suburb,
            lat: p.lat,
            lng: p.lng,
            currentTechId: p.technician_id,
            currentTechName: p.technician_name,
            recurrence: p.active_plan?.recurrence ?? null,
            preferredDay: p.active_plan?.preferred_day_of_week ?? null,
            planId: p.active_plan?.id ?? null,
          })),
          technicians: technicians.map((t: any, i: number) => ({
            id: t.id,
            name: t.name,
            color: techColors[i % techColors.length]
          }))
        })
      })
      const result = await res.json()
      recommendations = result.recommendations ?? []
      selectedRecs = new Set(
        recommendations
          .filter((r: any) => r.suggestedTechId !== r.currentTechId)
          .map((r: any) => r.propertyId)
      )
      showingRecs = true
    } catch (e) {
      console.error('AI error:', e)
    } finally {
      loadingAI = false
    }
  }

  function toggleRec(propertyId: string) {
    const next = new Set(selectedRecs)
    if (next.has(propertyId)) next.delete(propertyId)
    else next.add(propertyId)
    selectedRecs = next
  }

  function getTechName(techId: string): string {
    return technicians.find((t: any) => t.id === techId)?.name ?? '—'
  }

  function discardRecs() {
    recommendations = []
    selectedRecs = new Set()
    showingRecs = false
  }
</script>

<div class="max-w-2xl">
  <div class="mb-4">
    <a href="/customers" class="text-sm text-muted hover:text-text transition-colors">← Customers</a>
    <div class="flex items-center justify-between mt-2">
      <div>
        <h1 class="text-xl font-semibold text-text">Properties map</h1>
        <p class="text-sm text-muted">{properties.length} properties · tap a pin to reassign</p>
      </div>
      <button onclick={getRecommendations} disabled={loadingAI || technicians.length < 2}
        class="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl
               hover:bg-slate-800 transition-colors disabled:opacity-50">
        {#if loadingAI}
          <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          Thinking…
        {:else}
          ✨ Recommend zones
        {/if}
      </button>
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
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 rounded-full flex-shrink-0 bg-slate-400"></span>
          <span class="text-xs text-muted">Unassigned</span>
        </div>
      </div>
    </div>
  {/if}

  <!-- Map -->
  <div bind:this={mapEl} class="w-full h-[320px] rounded-xl border border-border mb-4 bg-surface"></div>

  <!-- AI Recommendations panel -->
  {#if showingRecs && recommendations.length > 0}
    {@const changes = recommendations.filter((r: any) => r.suggestedTechId !== r.currentTechId)}
    <div class="bg-slate-900 text-white rounded-xl p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <div>
          <p class="text-sm font-semibold">Zone recommendations</p>
          <p class="text-xs text-slate-400 mt-0.5">
            {changes.length} change{changes.length !== 1 ? 's' : ''} suggested · map shows suggested colors
          </p>
        </div>
        <button onclick={discardRecs} class="text-slate-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {#if changes.length === 0}
        <p class="text-sm text-slate-400 mb-4">Current assignment is already optimal.</p>
      {:else}
        <div class="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {#each changes as rec}
            {@const prop = properties.find((p: any) => p.id === rec.propertyId)}
            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox"
                checked={selectedRecs.has(rec.propertyId)}
                onchange={() => toggleRec(rec.propertyId)}
                class="mt-0.5 flex-shrink-0 accent-sky-400" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm text-white">{prop?.customers?.name ?? '—'}</p>
                  <div class="flex items-center gap-1 text-xs">
                    <span class="w-2 h-2 rounded-full"
                      style="background-color: {techColorMap[rec.currentTechId] ?? '#94A3B8'}"></span>
                    <span class="text-slate-400">{getTechName(rec.currentTechId)}</span>
                    <span class="text-slate-500 mx-0.5">→</span>
                    <span class="w-2 h-2 rounded-full"
                      style="background-color: {techColorMap[rec.suggestedTechId] ?? '#94A3B8'}"></span>
                    <span class="text-white font-medium">{getTechName(rec.suggestedTechId)}</span>
                  </div>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">{rec.reason}</p>
              </div>
            </label>
          {/each}
        </div>

        <div class="flex items-center gap-3">
          <button onclick={() => selectedRecs = new Set(changes.map((r: any) => r.propertyId))}
            class="text-xs text-slate-400 hover:text-white transition-colors">Select all</button>
          <span class="text-slate-600">·</span>
          <button onclick={() => selectedRecs = new Set()}
            class="text-xs text-slate-400 hover:text-white transition-colors">Deselect all</button>
          <div class="flex-1"></div>
          <form method="POST" action="?/applyRecommendations" use:enhance={() => {
            applyingRecs = true
            return async ({ update }) => {
              await update()
              applyingRecs = false
              discardRecs()
              window.location.reload()
            }
          }}>
            <input type="hidden" name="recommendations"
              value={JSON.stringify(
                recommendations
                  .filter((r: any) => selectedRecs.has(r.propertyId))
                  .map((r: any) => ({ planId: r.planId, propertyId: r.propertyId, technicianId: r.suggestedTechId }))
              )} />
            <button type="submit" disabled={applyingRecs || selectedRecs.size === 0}
              class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
              {applyingRecs ? 'Applying…' : `Apply ${selectedRecs.size} change${selectedRecs.size !== 1 ? 's' : ''}`}
            </button>
          </form>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Property detail panel -->
  {#if selectedProperty}
    <div class="bg-card border border-border rounded-xl p-4 mb-4">
      <div class="flex items-start justify-between mb-3">
        <div>
          <p class="text-sm font-semibold text-text">{selectedProperty.customers?.name}</p>
          <p class="text-xs text-muted">{selectedProperty.address}{#if selectedProperty.suburb}, {selectedProperty.suburb}{/if}</p>
        </div>
        <button onclick={() => selectedProperty = null}
          class="p-1 text-muted hover:text-text transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {#if selectedProperty.active_plan}
        <div class="mb-3">
          <p class="text-xs text-muted mb-1">Current technician</p>
          <div class="flex items-center gap-2">
            {#if selectedProperty.technician_id}
              <span class="w-3 h-3 rounded-full flex-shrink-0"
                style="background-color: {techColorMap[selectedProperty.technician_id] ?? '#94A3B8'}"></span>
            {/if}
            <p class="text-sm text-text">{selectedProperty.technician_name ?? 'Unassigned'}</p>
          </div>
          <p class="text-xs text-muted mt-1 capitalize">{selectedProperty.active_plan.recurrence} service</p>
        </div>
        <form method="POST" action="?/reassignTechnician" use:enhance={() => {
          reassigning = true
          return async ({ update }) => {
            await update()
            reassigning = false
            selectedProperty = null
            window.location.reload()
          }
        }}>
          <input type="hidden" name="planId" value={selectedProperty.active_plan.id} />
          <input type="hidden" name="propertyId" value={selectedProperty.id} />
          <p class="text-xs text-muted mb-1">Reassign to</p>
          <div class="flex gap-2">
            <select name="technicianId" bind:value={selectedTechId}
              class="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary">
              {#each technicians as tech}
                <option value={tech.id}>{tech.name}</option>
              {/each}
            </select>
            <button type="submit" disabled={reassigning || !selectedTechId}
              class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
              {reassigning ? 'Saving…' : 'Reassign'}
            </button>
          </div>
          <p class="text-xs text-muted mt-2">This will update the service plan and regenerate future visits.</p>
        </form>
      {:else}
        <p class="text-xs text-muted">No active service plan — <a href="/customers/{selectedProperty.customers?.id}/properties/{selectedProperty.id}/plans/new" class="text-primary underline">add one</a>.</p>
      {/if}
    </div>
  {/if}
</div>