<script lang="ts">
  import { enhance } from '$app/forms'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { properties, technicians, googleMapsKey } = $derived(data)

  let map: any = null
  let mapEl: HTMLDivElement
  let selectedProperty = $state<any>(null)
  let reassigning = $state(false)
  let selectedTechId = $state<string>('')

  const techColors = [
    '#0EA5E9', '#8B5CF6', '#F59E0B', '#22C55E',
    '#EF4444', '#EC4899', '#14B8A6', '#F97316',
  ]

  let techColorMap = $derived(
    Object.fromEntries(
      technicians.map((t: any, i: number) => [t.id, techColors[i % techColors.length]])
    )
  )

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

    const bounds = new (window as any).google.maps.LatLngBounds()

    properties.forEach((p: any) => {
      const pos = { lat: p.lat, lng: p.lng }
      const color = p.technician_id ? (techColorMap[p.technician_id] ?? '#94A3B8') : '#94A3B8'

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
    })

    if (properties.length > 0) map.fitBounds(bounds)
  }
</script>

<div class="max-w-2xl">
  <!-- Header -->
  <div class="mb-4">
    <a href="/customers" class="text-sm text-muted hover:text-text transition-colors">← Customers</a>
    <div class="flex items-center justify-between mt-2">
      <div>
        <h1 class="text-xl font-semibold text-text">Properties map</h1>
        <p class="text-sm text-muted">{properties.length} properties · tap a pin to reassign</p>
      </div>
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
  <div bind:this={mapEl} class="w-full h-[300px] rounded-xl border border-border mb-4 bg-surface"></div>

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
            <select
  name="technicianId"
  bind:value={selectedTechId}
  class="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary">
  {#each technicians as tech}
    <option value={tech.id}>{tech.name}</option>
  {/each}
</select>
            
            <button type="submit" disabled={reassigning || selectedTechId === selectedProperty.technician_id}
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