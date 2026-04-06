<script lang="ts">
  import { enhance } from '$app/forms'
  import { createClient } from '@supabase/supabase-js'
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { visit, checklist } = $derived(data)

  let fromRoute = $state(false)
  let loading = $state(false)
  let loadingAI = $state(false)
  let recommendations = $state<any[]>([])
  let aiError = $state('')

  // Accordions
  let openWaterTest = $state(true)
  let openRecommendations = $state(false)
  let openChemicals = $state(true)

  // Checkboxes con state para que carguen correctamente
  let generalClean = $state(false)
  let spinFilter = $state(false)

  onMount(() => {
    // Cargar checkboxes desde checklist existente
    generalClean = checklist?.general_clean ?? false
    spinFilter = checklist?.spin_filter ?? false

    // fromRoute desde sessionStorage
    if (data.fromRoute) {
      sessionStorage.setItem(`visit_origin_${visit.id}`, 'route')
      fromRoute = true
    } else {
      fromRoute = sessionStorage.getItem(`visit_origin_${visit.id}`) === 'route'
    }
  })

  const waterParams = [
    { name: 'ph',               label: 'pH',                min: 7.2,  max: 7.6,   step: '0.1', unit: '' },
    { name: 'chlorine',         label: 'Free chlorine',     min: 1,    max: 3,     step: '0.1', unit: 'ppm' },
    { name: 'alkalinity',       label: 'Alkalinity',        min: 80,   max: 120,   step: '1',   unit: 'ppm' },
    { name: 'stabiliser',       label: 'Stabiliser (CYA)',  min: 30,   max: 50,    step: '1',   unit: 'ppm' },
    { name: 'salt',             label: 'Salt',              min: 3000, max: 4500,  step: '10',  unit: 'ppm' },
    { name: 'calcium_hardness', label: 'Calcium hardness',  min: 200,  max: 400,   step: '1',   unit: 'ppm' },
  ]

  let values = $state<Record<string, string>>({
    ph:               String(checklist?.ph ?? ''),
    chlorine:         String(checklist?.chlorine ?? ''),
    alkalinity:       String(checklist?.alkalinity ?? ''),
    stabiliser:       String(checklist?.stabiliser ?? ''),
    salt:             String(checklist?.salt ?? ''),
    calcium_hardness: String(checklist?.calcium_hardness ?? ''),
  })

  function getStatus(name: string, min: number, max: number): 'ok' | 'low' | 'high' | 'empty' {
    const v = parseFloat(values[name])
    if (isNaN(v) || values[name] === '') return 'empty'
    if (v < min) return 'low'
    if (v > max) return 'high'
    return 'ok'
  }

  const statusStyle = {
    ok:    { bg: 'bg-green-50 border-green-300',  label: 'bg-green-100 text-green-700',  text: 'OK' },
    low:   { bg: 'bg-amber-50 border-amber-300',  label: 'bg-amber-100 text-amber-700',  text: 'Low' },
    high:  { bg: 'bg-red-50 border-red-300',      label: 'bg-red-100 text-red-700',      text: 'High' },
    empty: { bg: 'bg-white border-border',         label: '',                              text: '' },
  }

  let chemicals = $state<{ name: string; amount: string; unit: string }[]>(
    checklist?.chemicals_added?.length ? checklist.chemicals_added : []
  )
  function addChemical() { chemicals = [...chemicals, { name: '', amount: '', unit: 'L' }] }
  function removeChemical(i: number) { chemicals = chemicals.filter((_, idx) => idx !== i) }
  const units = ['L', 'mL', 'kg', 'g', 'tabs']

  let photos = $state<string[]>(checklist?.photos ?? [])
  let uploadingPhoto = $state(false)

  async function handlePhotoUpload(e: Event) {
    const input = e.target as HTMLInputElement
    if (!input.files?.length) return
    uploadingPhoto = true
    const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
    for (const file of Array.from(input.files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
      const path = `${visit.id}/${Date.now()}-${safeName}`
      const { data: uploaded, error } = await supabase.storage
        .from('visit-photos')
        .upload(path, file, { upsert: true })
      if (!error && uploaded) {
        const { data: { publicUrl } } = supabase.storage.from('visit-photos').getPublicUrl(uploaded.path)
        photos = [...photos, publicUrl]
      }
    }
    uploadingPhoto = false
    input.value = ''
  }

  function removePhoto(i: number) { photos = photos.filter((_, idx) => idx !== i) }

  async function getRecommendations() {
    loadingAI = true
    aiError = ''
    recommendations = []
    const waterTest = {
      ph:               parseFloat(values.ph) || null,
      chlorine:         parseFloat(values.chlorine) || null,
      alkalinity:       parseFloat(values.alkalinity) || null,
      stabiliser:       parseFloat(values.stabiliser) || null,
      salt:             parseFloat(values.salt) || null,
      calcium_hardness: parseFloat(values.calcium_hardness) || null,
    }
    try {
      const res = await fetch('/api/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waterTest,
          poolVolume: data.visit.properties?.pool_volume_litres,
          poolType: data.visit.properties?.pool_type
        })
      })
      const json = await res.json()
      recommendations = json.recommendations ?? []
      aiError = recommendations.length === 0 ? 'All parameters are within range — no action needed!' : ''
      openRecommendations = true
    } catch {
      aiError = 'Could not get recommendations. Try again.'
    } finally {
      loadingAI = false
    }
  }
</script>

<div class="max-w-2xl">
  <div class="mb-6">
    <a href="/visits/{visit.id}{fromRoute ? '?from=route' : ''}" class="text-sm text-muted hover:text-text transition-colors">← Visit</a>
    <h1 class="text-xl font-semibold text-text mt-2">{checklist ? 'Edit checklist' : 'Checklist'}</h1>
    <p class="text-sm text-muted">{visit.properties?.customers?.name} · {visit.properties?.address}</p>
  </div>

  <form method="POST" action="?/save{fromRoute ? '&from=route' : ''}" use:enhance={() => {
    loading = true
    return async ({ update }) => { await update(); loading = false }
  }}>
    <input type="hidden" name="photos" value={JSON.stringify(photos)} />

    <div class="space-y-3">

      <!-- Tasks -->
      <div class="bg-card border border-border rounded-xl p-4">
        <p class="text-sm font-medium text-text mb-3">Tasks</p>
        <div class="space-y-3">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="general_clean"
              bind:checked={generalClean}
              class="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
            <span class="text-sm text-text">General clean</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="spin_filter"
              bind:checked={spinFilter}
              class="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
            <span class="text-sm text-text">SpinDisk water test</span>
          </label>
        </div>
      </div>

      <!-- Water test -->
      <div class="bg-card border border-border rounded-xl overflow-hidden">
        <button type="button" onclick={() => openWaterTest = !openWaterTest}
          class="w-full flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors">
          <p class="text-sm font-medium text-text">Water test</p>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"
            class="transition-transform {openWaterTest ? 'rotate-180' : ''}">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {#if openWaterTest}
          <div class="px-4 pb-4 space-y-2 border-t border-border pt-3">
            {#each waterParams as param}
              {@const status = getStatus(param.name, param.min, param.max)}
              {@const style = statusStyle[status]}
              <div class="flex items-center gap-3 p-3 rounded-lg border transition-colors {style.bg}">
                <div class="flex-1">
                  <p class="text-xs font-medium text-text">{param.label}</p>
                  <p class="text-xs text-muted">{param.min}–{param.max}{param.unit ? ' ' + param.unit : ''}</p>
                </div>
                <input name={param.name} type="number" step={param.step}
                  bind:value={values[param.name]} placeholder="—"
                  class="w-24 px-3 py-1.5 rounded-lg border border-border bg-white text-text text-sm text-right
                         focus:outline-none focus:ring-2 focus:ring-primary" />
                {#if status !== 'empty'}
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium w-10 text-center {style.label}">{style.text}</span>
                {:else}
                  <span class="w-10"></span>
                {/if}
              </div>
            {/each}
            <button type="button" onclick={getRecommendations} disabled={loadingAI}
              class="w-full mt-2 flex items-center justify-center gap-1.5 py-2 bg-primary text-white text-xs font-medium rounded-lg
                     hover:bg-primary-dark transition-colors disabled:opacity-50">
              {#if loadingAI}
                <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Analysing…
              {:else}
                ✨ Get AI recommendations
              {/if}
            </button>
          </div>
        {/if}
      </div>

      <!-- AI Recommendations -->
      <div class="bg-card border border-border rounded-xl overflow-hidden">
        <button type="button" onclick={() => openRecommendations = !openRecommendations}
          class="w-full flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors">
          <div class="flex items-center gap-2">
            <p class="text-sm font-medium text-text">Chemical recommendations</p>
            {#if recommendations.length > 0}
              <span class="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{recommendations.length}</span>
            {/if}
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"
            class="transition-transform {openRecommendations ? 'rotate-180' : ''}">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {#if openRecommendations}
          <div class="px-4 pb-4 border-t border-border pt-3 space-y-2">
            {#if aiError}
              <p class="text-xs text-muted">{aiError}</p>
            {/if}
            {#each recommendations as rec}
              <div class="p-3 rounded-lg border {rec.status === 'low' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}">
                <div class="flex items-center justify-between mb-1">
                  <p class="text-xs font-medium {rec.status === 'low' ? 'text-amber-700' : 'text-red-700'}">
                    {rec.parameter} — {rec.status === 'low' ? 'Too low' : 'Too high'}
                  </p>
                  <span class="text-xs font-semibold {rec.status === 'low' ? 'text-amber-700' : 'text-red-700'}">{rec.amount}</span>
                </div>
                <p class="text-xs text-text font-medium">{rec.action}</p>
                {#if rec.note}<p class="text-xs text-muted mt-0.5">{rec.note}</p>{/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Chemicals added -->
      <div class="bg-card border border-border rounded-xl overflow-hidden">
        <button type="button" onclick={() => openChemicals = !openChemicals}
          class="w-full flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors">
          <div class="flex items-center gap-2">
            <p class="text-sm font-medium text-text">Chemicals added</p>
            {#if chemicals.length > 0}
              <span class="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{chemicals.length}</span>
            {/if}
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"
            class="transition-transform {openChemicals ? 'rotate-180' : ''}">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {#if openChemicals}
          <div class="px-4 pb-4 border-t border-border pt-3">
            {#each chemicals as chem, i}
              <input type="hidden" name="chemical_name_{i}" bind:value={chem.name} />
              <input type="hidden" name="chemical_amount_{i}" bind:value={chem.amount} />
              <input type="hidden" name="chemical_unit_{i}" bind:value={chem.unit} />
              <div class="flex gap-2 items-center mb-2">
                <input type="text" placeholder="Product name" bind:value={chem.name}
                  class="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <input type="number" placeholder="Qty" step="0.1" bind:value={chem.amount}
                  class="w-20 px-3 py-2 rounded-lg border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <select bind:value={chem.unit}
                  class="px-2 py-2 rounded-lg border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {#each units as u}<option value={u}>{u}</option>{/each}
                </select>
                <button type="button" onclick={() => removeChemical(i)} class="p-2 text-muted hover:text-danger transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            {/each}
            <button type="button" onclick={addChemical}
              class="w-full py-2 border border-dashed border-border text-xs text-muted rounded-lg hover:bg-surface transition-colors">
              + Add chemical
            </button>
          </div>
        {/if}
      </div>

      <!-- Photos -->
      <div class="bg-card border border-border rounded-xl p-4">
        <p class="text-sm font-medium text-text mb-3">Photos</p>
        <div class="grid grid-cols-3 gap-2 mb-3">
          {#each photos as url, i}
            <div class="relative aspect-square">
              <img src={url} alt="Visit photo" class="w-full h-full object-cover rounded-lg" />
              <button type="button" onclick={() => removePhoto(i)}
                class="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/70">
                ×
              </button>
            </div>
          {/each}
          <label class="aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-surface transition-colors {uploadingPhoto ? 'opacity-50' : ''}">
            {#if uploadingPhoto}
              <svg class="animate-spin text-muted" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" class="text-muted"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span class="text-xs text-muted mt-1">Add photo</span>
            {/if}
            <input type="file" accept="image/*" multiple class="hidden" onchange={handlePhotoUpload} disabled={uploadingPhoto} />
          </label>
        </div>
      </div>

      <!-- Notes -->
      <div class="bg-card border border-border rounded-xl p-4">
        <label for="notes" class="block text-sm font-medium text-text mb-2">Notes</label>
        <textarea id="notes" name="notes" rows="3"
          placeholder="Any observations, issues, recommendations..."
          class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
        >{checklist?.notes ?? ''}</textarea>
      </div>

      <button type="submit" disabled={loading}
        class="w-full py-3 bg-primary text-white text-sm font-medium rounded-xl
               hover:bg-primary-dark transition-colors disabled:opacity-50">
        {loading ? 'Saving…' : checklist ? 'Update checklist' : 'Save checklist'}
      </button>

    </div>
  </form>
</div>