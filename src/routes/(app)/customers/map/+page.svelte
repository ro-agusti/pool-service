<!-- src/routes/(app)/customers/map/+page.svelte -->
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

  // Auto-assign state
  let computing = $state(false)
  let assignments = $state<any[]>([])
  let selectedAssignments = $state<Set<string>>(new Set())
  let applying = $state(false)
  let showingPreview = $state(false)

  const techColors = [
    '#0EA5E9', '#8B5CF6', '#F59E0B', '#22C55E',
    '#EF4444', '#EC4899', '#14B8A6', '#F97316',
  ]

  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  let techColorMap = $derived(
    Object.fromEntries(
      technicians.map((t: any, i: number) => [t.id, techColors[i % techColors.length]])
    )
  )

  function getMarkerColor(p: any): string {
    if (showingPreview) {
      const a = assignments.find((r: any) => r.propertyId === p.id)
      if (a && selectedAssignments.has(p.id)) return techColorMap[a.technicianId] ?? '#94A3B8'
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
    const _ = showingPreview
    const __ = assignments.length
    const ___ = selectedAssignments.size
    if (map) updateMarkers()
  })

  // Run auto-assign algorithm server-side
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function computeAutoAssign() {
  computing = true
  assignments = []
  showingPreview = false

  try {
    const activeTechs = technicians.filter((t: any) => t.lat && t.lng)
    if (activeTechs.length === 0) return

    const activeIds = new Set(activeTechs.map((t: any) => t.id))
    const propertiesWithPlan = properties.filter((p: any) => p.active_plan && p.lat && p.lng)
    const loadMap: Record<string, number> = Object.fromEntries(activeTechs.map((t: any) => [t.id, 0]))

    // Hardest to assign first (fewest eligible techs)
    const sorted = [...propertiesWithPlan].sort((a: any, b: any) => {
      const eligA = activeTechs.filter((t: any) => (t.working_days ?? [1,2,3,4,5]).includes(a.active_plan.preferred_day_of_week + 1)).length
const eligB = activeTechs.filter((t: any) => (t.working_days ?? [1,2,3,4,5]).includes(b.active_plan.preferred_day_of_week + 1)).length
return eligA - eligB
    })

    const result: any[] = []

    for (const prop of sorted) {
      const dow = prop.active_plan.preferred_day_of_week
      const currentTechId = prop.active_plan.technician_id ?? null

      const eligible = activeTechs.filter((t: any) =>
  (t.working_days ?? [1,2,3,4,5]).includes(dow + 1)
)
      if (eligible.length === 0) continue

      const ranked = eligible
        .map((t: any) => ({
          ...t,
          dist: haversine(prop.lat, prop.lng, t.lat, t.lng),
          load: loadMap[t.id] ?? 0
        }))
        .sort((a: any, b: any) => {
          if (a.load !== b.load) return a.load - b.load
          return a.dist - b.dist
        })

      const best = ranked[0]
      loadMap[best.id] = (loadMap[best.id] ?? 0) + 1

      result.push({
        planId: prop.active_plan.id,
        propertyId: prop.id,
        technicianId: best.id,
        currentTechId: activeIds.has(currentTechId) ? currentTechId : null,
        distKm: Math.round(best.dist),
        reason: `${Math.round(best.dist)} km from ${best.name}'s home`
      })
    }

    assignments = result
    selectedAssignments = new Set(
      assignments
        .filter((a: any) => a.technicianId !== a.currentTechId || a.currentTechId === null)
        .map((a: any) => a.propertyId)
    )
    showingPreview = true
  } finally {
    computing = false
  }
}

  function getTechName(id: string) {
    return technicians.find((t: any) => t.id === id)?.name ?? '—'
  }

  function discardAssignments() {
    assignments = []
    selectedAssignments = new Set()
    showingPreview = false
  }

  function toggleAssignment(propertyId: string) {
    const next = new Set(selectedAssignments)
    if (next.has(propertyId)) next.delete(propertyId)
    else next.add(propertyId)
    selectedAssignments = next
  }

  // Summary: load per tech in the preview
  let previewLoad = $derived(() => {
    const counts: Record<string, number> = {}
    for (const p of properties) {
      if (!p.active_plan) continue
      const a = assignments.find((r: any) => r.propertyId === p.id)
      const techId = (a && selectedAssignments.has(p.id)) ? a.technicianId : p.technician_id
      if (techId) counts[techId] = (counts[techId] ?? 0) + 1
    }
    return counts
  })
</script>

<div class="max-w-2xl">
  <div class="mb-4">
    <a href="/customers" class="text-sm text-muted hover:text-text transition-colors">← Customers</a>
    <div class="flex items-center justify-between mt-2">
      <div>
        <h1 class="text-xl font-semibold text-text">Properties map</h1>
        <p class="text-sm text-muted">{properties.length} properties · tap a pin to reassign</p>
      </div>
      <button onclick={computeAutoAssign} disabled={computing || technicians.length < 2}
        class="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl
               hover:bg-slate-800 transition-colors disabled:opacity-50">
        {#if computing}
          <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Computing…
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          Auto-assign zones
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
            {#if tech.working_days}
              <span class="text-xs text-muted">
                ({(tech.working_days as number[]).map((d: number) => dayLabels[d]).join(', ')})
              </span>
            {/if}
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
  <div bind:this={mapEl} class="w-full h-[340px] rounded-xl border border-border mb-4 bg-surface"></div>

  <!-- Auto-assign preview panel -->
  {#if showingPreview}
    {@const changes = assignments.filter((a: any) => 
  a.technicianId !== a.currentTechId || a.currentTechId === null
)}
    <div class="bg-slate-900 text-white rounded-xl p-4 mb-4">
      <div class="flex items-center justify-between mb-3">
        <div>
          <p class="text-sm font-semibold">Auto-assign preview</p>
          <p class="text-xs text-slate-400 mt-0.5">
            {changes.length} change{changes.length !== 1 ? 's' : ''} suggested · map shows preview colors
          </p>
        </div>
        <button onclick={discardAssignments} class="text-slate-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {#if changes.length === 0}
        <p class="text-sm text-slate-400 mb-3">Current assignment is already optimal given distances and working days.</p>
      {:else}
        <!-- Load summary per tech -->
        <div class="flex gap-3 mb-3 flex-wrap">
          {#each technicians as tech, i}
            {@const count = previewLoad()[tech.id] ?? 0}
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: {techColors[i % techColors.length]}"></span>
              <span class="text-xs text-slate-300">{tech.name}: <strong class="text-white">{count}</strong></span>
            </div>
          {/each}
        </div>

        <!-- Changes list -->
        <div class="space-y-2 mb-4 max-h-56 overflow-y-auto">
          {#each changes as a}
            {@const prop = properties.find((p: any) => p.id === a.propertyId)}
            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox"
                checked={selectedAssignments.has(a.propertyId)}
                onchange={() => toggleAssignment(a.propertyId)}
                class="mt-0.5 flex-shrink-0 accent-sky-400" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm text-white truncate">{prop?.customers?.name ?? '—'}</p>
                  <div class="flex items-center gap-1 text-xs">
                    <span class="w-2 h-2 rounded-full"
                      style="background-color: {techColorMap[a.currentTechId] ?? '#94A3B8'}"></span>
                    <span class="text-slate-400">{getTechName(a.currentTechId)}</span>
                    <span class="text-slate-500 mx-0.5">→</span>
                    <span class="w-2 h-2 rounded-full"
                      style="background-color: {techColorMap[a.technicianId]}"></span>
                    <span class="text-white font-medium">{getTechName(a.technicianId)}</span>
                  </div>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">{a.reason}</p>
              </div>
            </label>
          {/each}
        </div>

        <div class="flex items-center gap-3">
          <button onclick={() => selectedAssignments = new Set(changes.map((a: any) => a.propertyId))}
            class="text-xs text-slate-400 hover:text-white transition-colors">Select all</button>
          <span class="text-slate-600">·</span>
          <button onclick={() => selectedAssignments = new Set()}
            class="text-xs text-slate-400 hover:text-white transition-colors">None</button>
          <div class="flex-1"></div>

          {#if selectedAssignments.size > 0}
            <form method="POST" action="?/applyAutoAssign" use:enhance={() => {
              applying = true
              return async ({ update }) => {
                await update()
                applying = false
                discardAssignments()
                window.location.reload()
              }
            }}>
              <input type="hidden" name="assignments"
                value={JSON.stringify(
                  assignments.filter((a: any) => selectedAssignments.has(a.propertyId))
                )} />
              <button type="submit" disabled={applying}
                class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
                {applying ? 'Applying…' : `Apply ${selectedAssignments.size} change${selectedAssignments.size !== 1 ? 's' : ''}`}
              </button>
            </form>
          {/if}
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
          <p class="text-xs text-muted mt-1 capitalize">{selectedProperty.active_plan.recurrence} · {dayLabels[selectedProperty.active_plan.preferred_day_of_week]}</p>
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