<script lang="ts">
  import { enhance } from '$app/forms'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { products } = $derived(data)

  let showForm = $state(false)
  let editingId = $state<string | null>(null)

  let name       = $state('')
  let unit       = $state('unit')
  let unit_price = $state('')
  let is_chemical = $state(false)

  const units = ['unit', 'kg', 'g', 'L', 'mL', 'tab']

  function startEdit(p: any) {
    editingId  = p.id
    name       = p.name
    unit       = p.unit
    unit_price = String(p.unit_price)
    is_chemical = p.is_chemical
  }

  function cancelEdit() {
    editingId = null; showForm = false
    name = ''; unit = 'unit'; unit_price = ''; is_chemical = false
  }

  let services  = $derived(products.filter((p: any) => !p.is_chemical))
  let chemicals = $derived(products.filter((p: any) => p.is_chemical))

  // All IDs in current display order (services first, then chemicals)
  let allIds = $derived([...services, ...chemicals].map((p: any) => p.id).join(','))
</script>

<div class="max-w-2xl">
  <div class="flex items-center justify-between mb-6">
    <div>
      <a href="/settings" class="text-sm text-muted hover:text-text transition-colors">← Settings</a>
      <h1 class="text-xl font-semibold text-text mt-1">Products & Pricing</h1>
      <p class="text-sm text-muted">Set prices for services and chemicals used in invoices</p>
    </div>
    {#if !showForm && !editingId}
      <button onclick={() => { showForm = true; is_chemical = false }}
        class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
        + Add product
      </button>
    {/if}
  </div>

  <!-- Add form -->
  {#if showForm}
    <div class="bg-card border border-border rounded-xl p-4 mb-6">
      <h2 class="text-sm font-medium text-text mb-4">New product</h2>
      <form method="POST" action="?/create" use:enhance={() => {
        return async ({ update }) => { await update(); cancelEdit() }
      }}>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-muted mb-1">Name</label>
            <input type="text" name="name" bind:value={name} placeholder="e.g. General clean, Salt"
              class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-muted mb-1">Unit</label>
              <select name="unit" bind:value={unit}
                class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary">
                {#each units as u}<option value={u}>{u}</option>{/each}
              </select>
            </div>
            <div>
              <label class="block text-xs text-muted mb-1">Price per unit ($)</label>
              <input type="number" name="unit_price" bind:value={unit_price} step="0.01" min="0" placeholder="0.00"
                class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="is_chemical_new" bind:checked={is_chemical} class="rounded" />
            <input type="hidden" name="is_chemical" value={is_chemical ? 'true' : 'false'} />
            <label for="is_chemical_new" class="text-sm text-text">This is a chemical</label>
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button type="submit" class="flex-1 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">Save</button>
          <button type="button" onclick={cancelEdit} class="py-2 px-4 border border-border text-sm rounded-lg hover:bg-surface transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Services -->
  <h2 class="text-sm font-medium text-muted uppercase tracking-wide mb-2">Services</h2>
  {#if services.length === 0}
    <div class="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted mb-6">
      No services yet — add General clean, SpinDisk water test, etc.
    </div>
  {:else}
    <div class="bg-card border border-border rounded-xl overflow-hidden mb-6">
      {#each services as p, i}
        {#if editingId === p.id}
          <div class="px-4 py-3 {i !== 0 ? 'border-t border-border' : ''}">
            <form method="POST" action="?/update" use:enhance={() => {
              return async ({ update }) => { await update(); cancelEdit() }
            }}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="is_chemical" value="false" />
              <div class="space-y-2">
                <input type="text" name="name" bind:value={name}
                  class="w-full px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                <div class="grid grid-cols-2 gap-2">
                  <select name="unit" bind:value={unit}
                    class="px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                    {#each units as u}<option value={u}>{u}</option>{/each}
                  </select>
                  <input type="number" name="unit_price" bind:value={unit_price} step="0.01"
                    class="px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div class="flex gap-2 mt-2">
                <button type="submit" class="flex-1 py-1.5 bg-primary text-white text-xs font-medium rounded-lg">Save</button>
                <button type="button" onclick={cancelEdit} class="py-1.5 px-3 border border-border text-xs rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        {:else}
          <div class="px-4 py-3 flex items-center gap-2 {i !== 0 ? 'border-t border-border' : ''}">
            <!-- Reorder buttons -->
            <div class="flex flex-col gap-0.5 flex-shrink-0">
              <form method="POST" action="?/reorder" use:enhance={() => { return async ({ update }) => { await update() } }}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="direction" value="up" />
                <input type="hidden" name="all_ids" value={allIds} />
                <button type="submit" disabled={i === 0}
                  class="p-0.5 text-muted hover:text-text disabled:opacity-30 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
              </form>
              <form method="POST" action="?/reorder" use:enhance={() => { return async ({ update }) => { await update() } }}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="direction" value="down" />
                <input type="hidden" name="all_ids" value={allIds} />
                <button type="submit" disabled={i === services.length - 1}
                  class="p-0.5 text-muted hover:text-text disabled:opacity-30 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </form>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text">{p.name}</p>
              <p class="text-xs text-muted">${p.unit_price.toFixed(2)} / {p.unit}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button onclick={() => startEdit(p)} class="p-1.5 text-muted hover:text-text border border-border rounded-lg hover:bg-surface transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <form method="POST" action="?/delete" use:enhance={() => { return async ({ update }) => { await update() } }}>
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" class="p-1.5 text-muted hover:text-danger border border-border rounded-lg hover:bg-red-50 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </form>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Chemicals -->
  <h2 class="text-sm font-medium text-muted uppercase tracking-wide mb-2">Chemicals</h2>
  {#if chemicals.length === 0}
    <div class="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted">
      No chemicals yet — add Salt, Liquid chlorine, Buffer, etc.
    </div>
  {:else}
    <div class="bg-card border border-border rounded-xl overflow-hidden">
      {#each chemicals as p, i}
        {#if editingId === p.id}
          <div class="px-4 py-3 {i !== 0 ? 'border-t border-border' : ''}">
            <form method="POST" action="?/update" use:enhance={() => {
              return async ({ update }) => { await update(); cancelEdit() }
            }}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="is_chemical" value="true" />
              <div class="space-y-2">
                <input type="text" name="name" bind:value={name}
                  class="w-full px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                <div class="grid grid-cols-2 gap-2">
                  <select name="unit" bind:value={unit}
                    class="px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                    {#each units as u}<option value={u}>{u}</option>{/each}
                  </select>
                  <input type="number" name="unit_price" bind:value={unit_price} step="0.01"
                    class="px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div class="flex gap-2 mt-2">
                <button type="submit" class="flex-1 py-1.5 bg-primary text-white text-xs font-medium rounded-lg">Save</button>
                <button type="button" onclick={cancelEdit} class="py-1.5 px-3 border border-border text-xs rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        {:else}
          <div class="px-4 py-3 flex items-center gap-2 {i !== 0 ? 'border-t border-border' : ''}">
            <!-- Reorder buttons -->
            <div class="flex flex-col gap-0.5 flex-shrink-0">
              <form method="POST" action="?/reorder" use:enhance={() => { return async ({ update }) => { await update() } }}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="direction" value="up" />
                <input type="hidden" name="all_ids" value={allIds} />
                <button type="submit" disabled={i === 0}
                  class="p-0.5 text-muted hover:text-text disabled:opacity-30 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
              </form>
              <form method="POST" action="?/reorder" use:enhance={() => { return async ({ update }) => { await update() } }}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="direction" value="down" />
                <input type="hidden" name="all_ids" value={allIds} />
                <button type="submit" disabled={i === chemicals.length - 1}
                  class="p-0.5 text-muted hover:text-text disabled:opacity-30 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </form>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text">{p.name}</p>
              <p class="text-xs text-muted">${p.unit_price.toFixed(2)} / {p.unit}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button onclick={() => startEdit(p)} class="p-1.5 text-muted hover:text-text border border-border rounded-lg hover:bg-surface transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <form method="POST" action="?/delete" use:enhance={() => { return async ({ update }) => { await update() } }}>
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" class="p-1.5 text-muted hover:text-danger border border-border rounded-lg hover:bg-red-50 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </form>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>