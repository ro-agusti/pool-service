<script lang="ts">
  import { enhance } from '$app/forms'
  import { createClient } from '@supabase/supabase-js'
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { visit, checklist, fromRoute: fr, services, chemicals: chemicalProducts } = $derived(data)

  let fromRoute = $state(false)
  let loading = $state(false)
  let loadingAI = $state(false)
  let recommendations = $state<any[]>([])
  let aiError = $state('')

  let openWaterTest       = $state(true)
  let openRecommendations = $state(false)
  let openChemicals       = $state(true)

  // Tasks — set of product ids that are checked
  let tasksChecked = $state<Set<string>>(new Set())

  // Chemicals — { product_id, name, unit, unit_price, amount }
  type ChemLine = { product_id: string; name: string; unit: string; unit_price: number; amount: string }
  let chemLines = $state<ChemLine[]>([])

  onMount(() => {
    fromRoute = fr || sessionStorage.getItem(`visit_origin_${visit.id}`) === 'route'
    if (fr) sessionStorage.setItem(`visit_origin_${visit.id}`, 'route')

    // Restore tasks from saved checklist
    if (checklist?.tasks_completed?.length) {
      tasksChecked = new Set(checklist.tasks_completed)
    }

    // Siempre mostrar todos los chemicals del catálogo
    // con las cantidades guardadas donde corresponda
    const savedChemicals: any[] = checklist?.chemicals_added ?? []
    const savedMap = new Map(savedChemicals.map((c: any) => [c.product_id, c]))

    chemLines = chemicalProducts.map(p => {
      const saved = savedMap.get(p.id)
      return {
        product_id: p.id,
        name: p.name,
        unit: p.unit,
        unit_price: p.unit_price,
        amount: saved ? String(saved.amount) : ''
      }
    })

    // Agregar customs (sin product_id) que estaban guardados
    const customs = savedChemicals.filter((c: any) => !c.product_id)
    chemLines = [...chemLines, ...customs.map((c: any) => ({
      product_id: '',
      name: c.name,
      unit: c.unit,
      unit_price: c.unit_price ?? 0,
      amount: String(c.amount)
    }))]
  })

  function toggleTask(id: string) {
    const s = new Set(tasksChecked)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    tasksChecked = s
  }

  function addCustomChemical() {
    chemLines = [...chemLines, { product_id: '', name: '', unit: 'L', unit_price: 0, amount: '' }]
  }
  function removeChemLine(i: number) {
    chemLines = chemLines.filter((_, idx) => idx !== i)
  }

  // Totals
  let servicesTotal = $derived(
    services
      .filter(s => tasksChecked.has(s.id))
      .reduce((sum, s) => sum + s.unit_price, 0)
  )
  let chemicalsTotal = $derived(
    chemLines.reduce((sum, c) => {
      const amt = parseFloat(c.amount)
      return sum + (isNaN(amt) ? 0 : amt * c.unit_price)
    }, 0)
  )
  let grandTotal = $derived(servicesTotal + chemicalsTotal)

  // Water test
  const waterParams = [
    { name: 'ph',               label: 'pH',               min: 7.2,  max: 7.6,   step: '0.1', unit: '' },
    { name: 'chlorine',         label: 'Free chlorine',    min: 1,    max: 3,     step: '0.1', unit: 'ppm' },
    { name: 'alkalinity',       label: 'Alkalinity',       min: 80,   max: 120,   step: '1',   unit: 'ppm' },
    { name: 'stabiliser',       label: 'Stabiliser (CYA)', min: 30,   max: 50,    step: '1',   unit: 'ppm' },
    { name: 'salt',             label: 'Salt',             min: 3000, max: 4500,  step: '10',  unit: 'ppm' },
    { name: 'calcium_hardness', label: 'Calcium hardness', min: 200,  max: 400,   step: '1',   unit: 'ppm' },
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
      const { data: uploaded, error } = await supabase.storage.from('visit-photos').upload(path, file, { upsert: true })
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
    loadingAI = true; aiError = ''; recommendations = []
    const waterTest = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, parseFloat(v) || null])
    )
    try {
      const res = await fetch('/api/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waterTest, poolVolume: visit.properties?.pool_volume_litres, poolType: visit.properties?.pool_type })
      })
      const json = await res.json()
      recommendations = json.recommendations ?? []
      aiError = recommendations.length === 0 ? 'All parameters are within range — no action needed!' : ''
      openRecommendations = true
    } catch { aiError = 'Could not get recommendations. Try again.' }
    finally { loadingAI = false }
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
    <input type="hidden" name="tasks_completed" value={JSON.stringify([...tasksChecked])} />
    <input type="hidden" name="chemicals_added" value={JSON.stringify(
      chemLines
        .filter(c => c.amount !== '' && parseFloat(c.amount) > 0)
        .map(c => ({ product_id: c.product_id, name: c.name, unit: c.unit, unit_price: c.unit_price, amount: parseFloat(c.amount) }))
    )} />

    <div class="space-y-3">

      <!-- Tasks / Services -->
      {#if services.length > 0}
        <div class="bg-card border border-border rounded-xl p-4">
          <p class="text-sm font-medium text-text mb-3">Tasks</p>
          <div class="space-y-2">
            {#each services as svc}
              <label class="flex items-center justify-between gap-3 cursor-pointer py-1">
                <div class="flex items-center gap-3">
                  <input type="checkbox"
                    checked={tasksChecked.has(svc.id)}
                    onchange={() => toggleTask(svc.id)}
                    class="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
                  <span class="text-sm text-text">{svc.name}</span>
                </div>
                <span class="text-sm text-muted">${svc.unit_price.toFixed(2)}</span>
              </label>
            {/each}
          </div>
          {#if servicesTotal > 0}
            <div class="mt-3 pt-3 border-t border-border flex justify-between">
              <span class="text-xs text-muted">Services subtotal</span>
              <span class="text-xs font-medium text-text">${servicesTotal.toFixed(2)}</span>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Water test -->
      <div class="bg-card border border-border rounded-xl overflow-hidden">
        <button type="button" onclick={() => openWaterTest = !openWaterTest}
          class="w-full flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors">
          <p class="text-sm font-medium text-text">Water test</p>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" class="transition-transform {openWaterTest ? 'rotate-180' : ''}"><polyline points="6 9 12 15 18 9"/></svg>
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
                <input name={param.name} type="number" step={param.step} bind:value={values[param.name]} placeholder="—"
                  class="w-24 px-3 py-1.5 rounded-lg border border-border bg-white text-text text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary" />
                {#if status !== 'empty'}
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium w-10 text-center {style.label}">{style.text}</span>
                {:else}
                  <span class="w-10"></span>
                {/if}
              </div>
            {/each}
            <button type="button" onclick={getRecommendations} disabled={loadingAI}
              class="w-full mt-2 flex items-center justify-center gap-1.5 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
              {#if loadingAI}
                <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Analysing…
              {:else}✨ Get AI recommendations{/if}
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" class="transition-transform {openRecommendations ? 'rotate-180' : ''}"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {#if openRecommendations}
          <div class="px-4 pb-4 border-t border-border pt-3 space-y-2">
            {#if aiError}<p class="text-xs text-muted">{aiError}</p>{/if}
            {#each recommendations as rec}
              <div class="p-3 rounded-lg border {rec.status === 'low' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}">
                <div class="flex items-center justify-between mb-1">
                  <p class="text-xs font-medium {rec.status === 'low' ? 'text-amber-700' : 'text-red-700'}">{rec.parameter} — {rec.status === 'low' ? 'Too low' : 'Too high'}</p>
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
            {#if chemicalsTotal > 0}
              <span class="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">${chemicalsTotal.toFixed(2)}</span>
            {/if}
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" class="transition-transform {openChemicals ? 'rotate-180' : ''}"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {#if openChemicals}
          <div class="px-4 pb-4 border-t border-border pt-3 space-y-2">
            {#each chemLines as line, i}
              {#if line.product_id}
                <!-- Catalog chemical — same layout as before -->
                <div class="flex items-center gap-2">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-text truncate">{line.name}</p>
                    <p class="text-xs text-muted">${line.unit_price.toFixed(2)} / {line.unit}</p>
                  </div>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <input type="number" placeholder="0" step="0.1" min="0" bind:value={line.amount}
                      class="w-20 px-2 py-1.5 text-sm border border-border rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-primary" />
                    <span class="text-xs text-muted w-6">{line.unit}</span>
                  </div>
                  {#if parseFloat(line.amount) > 0 && line.unit_price > 0}
                    <span class="text-xs font-medium text-text w-16 text-right flex-shrink-0">
                      ${(parseFloat(line.amount) * line.unit_price).toFixed(2)}
                    </span>
                  {:else}
                    <span class="w-16 flex-shrink-0"></span>
                  {/if}
                </div>
              {:else}
                <!-- Custom chemical -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <input type="text" placeholder="Product name" bind:value={line.name}
                      class="flex-1 min-w-0 px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                    <input type="number" placeholder="0" step="0.1" min="0" bind:value={line.amount}
                      class="w-16 px-2 py-1.5 text-sm border border-border rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-primary" />
                    <select bind:value={line.unit}
                      class="px-1 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                      {#each ['L','mL','kg','g','tabs'] as u}<option value={u}>{u}</option>{/each}
                    </select>
                    {#if parseFloat(line.amount) > 0 && parseFloat(String(line.unit_price)) > 0}
                      <span class="text-xs font-medium text-text flex-shrink-0">
                        ${(parseFloat(line.amount) * parseFloat(String(line.unit_price))).toFixed(2)}
                      </span>
                    {/if}
                    <button type="button" onclick={() => removeChemLine(i)} class="p-1 text-muted hover:text-danger transition-colors flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div class="flex items-center gap-1 mt-1 pl-0.5">
                    <span class="text-xs text-muted">$</span>
                    <input type="number" placeholder="0.00" step="0.01" min="0" bind:value={line.unit_price}
                      class="w-20 px-2 py-1 text-xs border border-border rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-primary" />
                    <span class="text-xs text-muted">/ {line.unit}</span>
                  </div>
                </div>
              {/if}
            {/each}
            <button type="button" onclick={addCustomChemical}
              class="w-full py-2 border border-dashed border-border text-xs text-muted rounded-lg hover:bg-surface transition-colors mt-1">
              + Add other chemical
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
                class="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/70">×</button>
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
        <textarea id="notes" name="notes" rows="3" placeholder="Any observations, issues, recommendations..."
          class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
        >{checklist?.notes ?? ''}</textarea>
      </div>

      <!-- Total -->
      {#if grandTotal > 0}
        <div class="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <span class="text-sm font-medium text-text">Total</span>
          <span class="text-lg font-bold text-primary">${grandTotal.toFixed(2)}</span>
        </div>
      {/if}

      <button type="submit" disabled={loading}
        class="w-full py-3 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50">
        {loading ? 'Saving…' : checklist ? 'Update checklist' : 'Save checklist'}
      </button>

    </div>
  </form>
</div>