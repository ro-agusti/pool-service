<script lang="ts">
  import { enhance } from '$app/forms'
  import { createClient } from '@supabase/supabase-js'
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
let { visit, checklist, visitHistory, fromRoute: fr, services, chemicals: chemicalProducts } = $derived(data)


  let fromRoute = $state(false)
  let loading = $state(false)
  let openChemicals = $state(true)

  // Tasks
  let tasksChecked = $state<Set<string>>(new Set())

  // Chemicals
  type ChemLine = { product_id: string; name: string; unit: string; unit_price: number; amount: string }
  let chemLines = $state<ChemLine[]>([])

  // Applied checkboxes — which recommendations the tech marked as done
  let appliedRecs = $state<Set<string>>(new Set())

  onMount(() => {
    fromRoute = fr || sessionStorage.getItem(`visit_origin_${visit.id}`) === 'route'
    if (fr) sessionStorage.setItem(`visit_origin_${visit.id}`, 'route')

    if (checklist?.tasks_completed?.length) {
      tasksChecked = new Set(checklist.tasks_completed)
    }

    const savedChemicals: any[] = checklist?.chemicals_added ?? []
    const savedMap = new Map(savedChemicals.map((c: any) => [c.product_id, c]))
    
    chemLines = chemicalProducts.map((p: any) => {
      const saved = savedMap.get(p.id)
      return { product_id: p.id, name: p.name, unit: p.unit, unit_price: p.unit_price, amount: saved ? String(saved.amount) : '' }
    })

    const customs = savedChemicals.filter((c: any) => !c.product_id)
    chemLines = [...chemLines, ...customs.map((c: any) => ({
      product_id: '', name: c.name, unit: c.unit, unit_price: c.unit_price ?? 0, amount: String(c.amount)
    }))]
  })

  function toggleTask(id: string) {
    const s = new Set(tasksChecked)
    if (s.has(id)) { s.delete(id) } else { s.add(id) }
    tasksChecked = s
  }

  function addCustomChemical() {
    chemLines = [...chemLines, { product_id: '', name: '', unit: 'L', unit_price: 0, amount: '' }]
  }
  function removeChemLine(i: number) { chemLines = chemLines.filter((_, idx) => idx !== i) }

  let servicesTotal = $derived(
    services.filter((s: any) => tasksChecked.has(s.id)).reduce((sum: number, s: any) => sum + s.unit_price, 0)
  )
  let chemicalsTotal = $derived(
    chemLines.reduce((sum, c) => { const a = parseFloat(c.amount); return sum + (isNaN(a) ? 0 : a * c.unit_price) }, 0)
  )
  let grandTotal = $derived(servicesTotal + chemicalsTotal)

  // ─── Water params — contextualized placeholders and steps ───
  const waterParams = [
    { name: 'ph',               label: 'pH',               min: 7.2,  max: 7.6,  ideal: 7.4,  step: '0.1',  unit: '',    placeholder: '7.4' },
    { name: 'chlorine',         label: 'Free chlorine',    min: 1,    max: 3,    ideal: 2,    step: '0.1',  unit: 'ppm', placeholder: '2' },
    { name: 'alkalinity',       label: 'Alkalinity',       min: 80,   max: 120,  ideal: 100,  step: '1',    unit: 'ppm', placeholder: '100' },
    { name: 'stabiliser',       label: 'Stabiliser (CYA)', min: 30,   max: 50,   ideal: 40,   step: '1',    unit: 'ppm', placeholder: '40' },
    { name: 'salt',             label: 'Salt',             min: 3000, max: 4500, ideal: 3750, step: '50',   unit: 'ppm', placeholder: '3750' },
    { name: 'calcium_hardness', label: 'Calcium hardness', min: 200,  max: 400,  ideal: 300,  step: '5',    unit: 'ppm', placeholder: '300' },
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

  function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function getHistoryStatus(val: number | null, min: number, max: number): 'ok' | 'low' | 'high' | 'empty' {
  if (val == null) return 'empty'
  if (val < min) return 'low'
  if (val > max) return 'high'
  return 'ok'
}

let historyPoints = $derived(
  (visitHistory ?? []).map((v: any) => ({
    date: v.scheduled_date,
    cl: v.visit_checklists?.[0] ?? null,
  }))
)

type TrendAlert = { label: string; direction: 'high' | 'low'; count: number }
let historyAlerts = $derived(
  historyPoints.length < 2
    ? ([] as TrendAlert[])
    : waterParams.reduce((alerts: TrendAlert[], p) => {
        const statuses = historyPoints.map((tp: any) => getHistoryStatus(tp.cl?.[p.name] ?? null, p.min, p.max))
        const last = statuses[statuses.length - 1]
        if (last !== 'high' && last !== 'low') return alerts
        let count = 0
        for (let i = statuses.length - 1; i >= 0; i--) {
          if (statuses[i] === last) count++
          else break
        }
        if (count >= 2) alerts.push({ label: p.label, direction: last, count })
        return alerts
      }, [])
)
  // ─── Deterministic dosing recommendations ───

function calcRec(name: string, val: number, min: number, max: number, ideal: number) {
  const vol = volL

  if (name === 'ph') {
    if (val < min) {
      const action = 'Add soda ash (Na₂CO₃)'
      if (!vol) return { action, amount: 'Volume needed for dosing' }
      const steps = (ideal - val) / 0.1
      const grams = Math.round(steps * 15 * vol / 10000)
      return { action, amount: grams >= 1000 ? `${(grams/1000).toFixed(2)} kg` : `${grams} g` }
    }
    if (val > max) {
      const action = 'Add dry acid (NaHSO₄)'
      if (!vol) return { action, amount: 'Volume needed for dosing' }
      const steps = (val - ideal) / 0.1
      const grams = Math.round(steps * 15 * vol / 10000)
      return { action, amount: grams >= 1000 ? `${(grams/1000).toFixed(2)} kg` : `${grams} g` }
    }
  }

  if (name === 'chlorine') {
    if (val < min) {
      const action = 'Add liquid chlorine'
      if (!vol) return { action, amount: 'Volume needed for dosing' }
      const grams = Math.round((ideal - val) * vol * 0.0075)
      return { action, amount: grams >= 1000 ? `${(grams/1000).toFixed(1)} L` : `${grams} mL` }
    }
    if (val > max) {
      return { action: 'Allow to dissipate naturally or reduce exposure time', amount: '—' }
    }
  }

  if (name === 'alkalinity') {
    if (val < min) {
      const action = 'Add buffer (sodium bicarbonate)'
      if (!vol) return { action, amount: 'Volume needed for dosing' }
      const kg = ((ideal - val) / 10) * 1.4 * vol / 100000
      return { action, amount: `${kg.toFixed(2)} kg` }
    }
    if (val > max) {
      const action = 'Add dry acid (sodium bisulfate)'
      if (!vol) return { action, amount: 'Volume needed for dosing' }
      const kg = ((val - ideal) / 10) * 1.2 * vol / 100000
      return { action, amount: `${kg.toFixed(2)} kg` }
    }
  }

  if (name === 'stabiliser') {
    if (val < min) {
      const action = 'Add stabiliser (cyanuric acid)'
      if (!vol) return { action, amount: 'Volume needed for dosing' }
      const kg = ((ideal - val) / 10) * 1.0 * vol / 100000
      return { action, amount: `${kg.toFixed(2)} kg` }
    }
    if (val > max) {
      return { action: 'Partial water replacement recommended', amount: `~${Math.round((val - ideal) / val * 100)}% water` }
    }
  }

  if (name === 'salt') {
    if (val < min) {
      const action = 'Add pool salt'
      if (!vol) return { action, amount: 'Volume needed for dosing' }
      const kg = (ideal - val) * vol / 1_000_000
      return { action, amount: `${kg.toFixed(1)} kg` }
    }
    if (val > max) {
      return { action: 'Partial water replacement recommended', amount: `~${Math.round((val - ideal) / val * 100)}% water` }
    }
  }

  if (name === 'calcium_hardness') {
    if (val < min) {
      const action = 'Add calcium hardness increaser'
      if (!vol) return { action, amount: 'Volume needed for dosing' }
      const kg = ((ideal - val) / 10) * 1.5 * vol / 100000
      return { action, amount: `${kg.toFixed(2)} kg` }
    }
    if (val > max) {
      return { action: 'Partial water replacement recommended', amount: `~${Math.round((val - ideal) / val * 100)}% water` }
    }
  }

  return null
}

  function getRec(name: string, min: number, max: number, ideal: number) {
    const v = parseFloat(values[name])
    if (isNaN(v) || values[name] === '') return null
    if (v >= min && v <= max) return null
    return calcRec(name, v, min, max, ideal)
  }

  function toggleApplied(name: string) {
  const s = new Set(appliedRecs)
  if (s.has(name)) {
    s.delete(name)
  } else {
    s.add(name)
    applyRecToChemical(name)  // ← auto-fill chemical on check
  }
  appliedRecs = s
}

  // Keyword map: water param → keywords to match in products catalog
const paramToKeywords: Record<string, string[]> = {
  ph_low:   ['soda ash', 'sodium carbonate', 'ph increaser', 'ph up'],
  ph_high:  ['dry acid', 'sodium bisulfate', 'ph reducer', 'ph down', 'acid'],
  chlorine: ['liquid chlorine', 'chlorine', 'sodium hypochlorite'],
  alkalinity_low:  ['buffer', 'sodium bicarbonate', 'bicarb', 'alkalinity up'],
  alkalinity_high: ['dry acid', 'acid'],
  stabiliser_low:  ['stabiliser', 'stabilizer', 'cyanuric', 'cya'],
  salt:     ['salt', 'pool salt', 'sodium chloride'],
  calcium_hardness_low: ['calcium', 'hardness', 'calcium hardness'],
}

function getParamKey(name: string, status: 'low' | 'high'): string {
  if (name === 'ph') return status === 'low' ? 'ph_low' : 'ph_high'
  if (name === 'alkalinity') return status === 'low' ? 'alkalinity_low' : 'alkalinity_high'
  if (name === 'stabiliser') return status === 'low' ? 'stabiliser_low' : ''
  if (name === 'calcium_hardness') return status === 'low' ? 'calcium_hardness_low' : ''
  if (name === 'salt') return status === 'low' ? 'salt' : ''
  if (name === 'chlorine') return status === 'low' ? 'chlorine' : ''
  return ''
}

function parseAmount(amountStr: string): { value: number; unit: string } | null {
  const m = amountStr.match(/^([\d.]+)\s*(kg|g|L|mL|tabs)?$/i)
  if (!m) return null
  let value = parseFloat(m[1])
  let unit = m[2] ?? 'g'
  // Normalize to base units: g→kg, mL→L
  if (unit.toLowerCase() === 'g') { value = value / 1000; unit = 'kg' }
  if (unit.toLowerCase() === 'ml') { value = value / 1000; unit = 'L' }
  return { value, unit }
}

function applyRecToChemical(paramName: string) {
  const status = getStatus(paramName, 
    waterParams.find(p => p.name === paramName)!.min,
    waterParams.find(p => p.name === paramName)!.max
  )
  if (status !== 'low' && status !== 'high') return
  
  const rec = getRec(paramName,
    waterParams.find(p => p.name === paramName)!.min,
    waterParams.find(p => p.name === paramName)!.max,
    waterParams.find(p => p.name === paramName)!.ideal
  )
  if (!rec) return

  const key = getParamKey(paramName, status)
  if (!key) return

  const keywords = paramToKeywords[key] ?? []
  const parsed = parseAmount(rec.amount)
  if (!parsed) return

  // Find matching product in chemLines by keyword
  const idx = chemLines.findIndex(line =>
    line.product_id &&
    keywords.some(kw => line.name.toLowerCase().includes(kw.toLowerCase()))
  )

  if (idx !== -1) {
    const existing = parseFloat(chemLines[idx].amount) || 0
    let amount = parsed.value
    // Only convert if catalog unit differs from normalized unit
    const lineUnit = chemLines[idx].unit.toLowerCase()
    if (parsed.unit.toLowerCase() === 'kg' && lineUnit === 'g') amount = amount * 1000
    if (parsed.unit.toLowerCase() === 'l' && lineUnit === 'ml') amount = amount * 1000
    chemLines = chemLines.map((line, i) =>
      i === idx ? { ...line, amount: (existing + amount).toFixed(2).replace(/\.00$/, '') } : line
    )
  } else {
    const recName = rec.action.replace(/^Add\s+/i, '').split('(')[0].trim()
    const existingCustomIdx = chemLines.findIndex(
      line => !line.product_id && line.name.toLowerCase() === recName.toLowerCase()
    )
    if (existingCustomIdx !== -1) {
      const existing = parseFloat(chemLines[existingCustomIdx].amount) || 0
      chemLines = chemLines.map((line, i) =>
        i === existingCustomIdx
          ? { ...line, amount: (existing + parsed.value).toFixed(2).replace(/\.00$/, '') }
          : line
      )
    } else {
      chemLines = [
        ...chemLines,
        { product_id: '', name: recName, unit: parsed.unit, unit_price: 0, amount: parsed.value.toFixed(2).replace(/\.00$/, '') }
      ]
    }
  }
}

  const statusStyle = {
    ok:    { bg: 'bg-green-50 border-green-200',  badge: 'bg-green-100 text-green-700',  text: 'OK' },
    low:   { bg: 'bg-amber-50 border-amber-200',  badge: 'bg-amber-100 text-amber-700',  text: 'Low' },
    high:  { bg: 'bg-red-50 border-red-200',      badge: 'bg-red-100 text-red-700',      text: 'High' },
    empty: { bg: 'bg-white border-border',         badge: '',                              text: '' },
  }

  // Photos
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
</script>

<div class="max-w-2xl">
  <div class="mb-6">
    <a href="/visits/{visit.id}{fromRoute ? '?from=route' : ''}" class="text-sm text-muted hover:text-text transition-colors">← Visit</a>
    <h1 class="text-xl font-semibold text-text mt-2">{checklist ? 'Edit checklist' : 'Checklist'}</h1>
    <p class="text-sm text-muted">{visit.properties?.customers?.name} · {visit.properties?.address}</p>
    {#if visit.properties?.pool_volume_litres}
      <p class="text-xs text-muted mt-0.5">{visit.properties.pool_volume_litres.toLocaleString()} L · {visit.properties.pool_type ?? ''}</p>
    {/if}
  </div>

  <form method="POST" action="?/save{fromRoute ? '&from=route' : ''}" novalidate use:enhance={() => {
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

      <!-- History trend (last visits, no today) -->
      {#if historyPoints.length > 0}
        <div class=" rounded-xl overflow-hidden bg-amber-50 border border-amber-400">
          <div class="px-4 py-3 border-b border-border">
            <p class="text-sm font-medium text-text">Previous readings</p>
            <p class="text-xs text-muted mt-0.5">Last {historyPoints.length} visit{historyPoints.length > 1 ? 's' : ''}</p>
          </div>
          <div class="px-4 py-3">
            {#if historyAlerts.length > 0}
              <div class="space-y-1.5 mb-3">
                {#each historyAlerts as alert}
                  <div class="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></span>
                    {alert.label} {alert.direction === 'high' ? 'elevated' : 'low'} for {alert.count} consecutive visits
                  </div>
                {/each}
              </div>
            {/if}
            <div class="overflow-x-auto  ">
              <table class="w-full text-sm" style="min-width: 200px;">
                <thead>
                  <tr class="border-b border-border">
                    <th class="text-left py-2 text-xs font-medium text-muted pr-4"></th>
                    {#each historyPoints as tp}
                      <th class="text-right py-2 px-2 text-xs font-medium text-muted whitespace-nowrap">
                        {formatDateShort(tp.date)}
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  {#each waterParams as param}
                    {@const hasAny = historyPoints.some((tp: any) => tp.cl?.[param.name] != null)}
                    {#if hasAny}
                      <tr>
                        <td class="py-2 text-xs text-muted pr-4 whitespace-nowrap">{param.label}</td>
                        {#each historyPoints as tp}
                          {@const val = tp.cl?.[param.name] ?? null}
                          {@const st = getHistoryStatus(val, param.min, param.max)}
                          <td class="py-2 px-2 text-right whitespace-nowrap">
                            {#if val != null}
                              <span class="text-xs font-medium
                                {st === 'ok' ? 'text-green-600' : st === 'high' ? 'text-red-500' : st === 'low' ? 'text-amber-500' : 'text-text'}">
                                {val}
                              </span>
                              {#if st === 'high'}<span class="text-red-400 text-[10px] ml-0.5">↑</span>
                              {:else if st === 'low'}<span class="text-amber-400 text-[10px] ml-0.5">↓</span>{/if}
                            {:else}
                              <span class="text-muted text-xs">—</span>
                            {/if}
                          </td>
                        {/each}
                      </tr>
                    {/if}
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/if}

      <!-- Tasks -->
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
  <div class="px-4 py-3 border-b border-border">
    <p class="text-sm font-medium text-text">Water test</p>
    <p class="text-xs text-muted mt-0.5">Ideal range shown — recommendations appear automatically</p>
    {#if !visit.properties?.pool_volume_litres}

      <div class="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <span>⚠️</span>
        <span>Pool volume not set — dosing estimates will be inaccurate.
          <a href="/customers/{visit.properties?.customer_id}/properties/{visit.property_id}/edit"
  class="underline font-medium">Add volume →</a>
        </span>
      </div>
    {/if}
  </div>
  <div class="px-4 pb-4 pt-3 space-y-3">
    {#each waterParams as param}
      {@const status = getStatus(param.name, param.min, param.max)}
      {@const style = statusStyle[status]}
      {@const rec = getRec(param.name, param.min, param.max, param.ideal)}

      <!-- Input row -->
      <div class="rounded-xl border transition-colors {style.bg} overflow-hidden">
        <div class="flex items-center gap-3 px-3 py-2.5">
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-text">{param.label}</p>
            <p class="text-xs text-muted">{param.min}–{param.max}{param.unit ? ' ' + param.unit : ''}</p>
          </div>
          <input
            name={param.name}
            type="number"
            step={param.step}
            bind:value={values[param.name]}
            placeholder={param.placeholder}
            class="w-28 px-3 py-1.5 rounded-lg border border-border bg-white text-text text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary tabular-nums"
          />
          <span class="text-xs text-muted w-8 text-left">{param.unit}</span>
          {#if status !== 'empty'}
            <span class="text-xs px-2 py-0.5 rounded-full font-medium w-10 text-center flex-shrink-0 {style.badge}">{style.text}</span>
          {:else}
            <span class="w-10 flex-shrink-0"></span>
          {/if}
        </div>

        <!-- Recommendation strip -->
        {#if rec}
          <div class="border-t {status === 'low' ? 'border-amber-200 bg-amber-50/60' : 'border-red-200 bg-red-50/60'} px-3 py-2 flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium {status === 'low' ? 'text-amber-700' : 'text-red-700'}">{rec.action}</p>
              <p class="text-xs font-bold {status === 'low' ? 'text-amber-800' : 'text-red-800'} mt-0.5">{rec.amount}</p>
            </div>
            {#if !checklist}
              <label class="flex items-center gap-1.5 flex-shrink-0 cursor-pointer mt-0.5">
                <input
                  type="checkbox"
                  checked={appliedRecs.has(param.name)}
                  onchange={() => toggleApplied(param.name)}
                  class="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span class="text-xs {status === 'low' ? 'text-amber-700' : 'text-red-700'}">Applied</span>
              </label>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
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