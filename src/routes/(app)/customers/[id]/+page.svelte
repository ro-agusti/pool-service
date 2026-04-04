<script lang="ts">
  import { enhance } from '$app/forms'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { customer, properties } = $derived(data)

  let confirmDeleteCustomer = $state(false)
  let confirmDeletePropertyId = $state<string | null>(null)
</script>

<div class="max-w-2xl">
  <!-- Header -->
  <div class="mb-6">
    <a href="/customers" class="text-sm text-muted hover:text-text transition-colors">← Customers</a>
    <div class="flex items-center justify-between mt-2">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span class="text-primary font-medium">{customer.name.charAt(0).toUpperCase()}</span>
        </div>
        <h1 class="text-2xl font-semibold text-text">{customer.name}</h1>
      </div>
      <div class="flex items-center gap-2">
        <a
          href="/customers/{customer.id}/edit"
          class="p-2 border border-border rounded-lg text-muted hover:text-text hover:bg-surface transition-colors"
          title="Edit customer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </a>
        {#if confirmDeleteCustomer}
          <form method="POST" action="?/deleteCustomer" use:enhance class="flex items-center gap-1">
            <span class="text-sm text-muted">Sure?</span>
            <button type="submit" class="px-3 py-1.5 bg-danger text-white text-sm rounded-lg hover:opacity-90">
              Yes
            </button>
            <button type="button" onclick={() => confirmDeleteCustomer = false}
              class="px-3 py-1.5 border border-border text-sm rounded-lg hover:bg-surface">
              No
            </button>
          </form>
        {:else}
          <button
            onclick={() => confirmDeleteCustomer = true}
            class="p-2 border border-border rounded-lg text-muted hover:text-danger hover:bg-red-50 transition-colors"
            title="Delete customer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Details -->
  <div class="bg-card border border-border rounded-xl divide-y divide-border">
    {#each [
      { label: 'Email', value: customer.email },
      { label: 'Phone', value: customer.phone },
      { label: 'Notes', value: customer.notes },
    ] as row}
      {#if row.value}
        <div class="px-4 py-3 flex gap-4">
          <span class="text-sm text-muted w-20 flex-shrink-0">{row.label}</span>
          <span class="text-sm text-text">{row.value}</span>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Properties section -->
  <div class="mt-8 flex items-center justify-between mb-3">
    <h2 class="text-lg font-medium text-text">Properties</h2>
    <a
      href="/customers/{customer.id}/properties/new"
      class="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
    >
      + Add property
    </a>
  </div>

  {#if properties.length === 0}
    <div class="bg-card border border-border rounded-xl p-8 text-center text-muted text-sm">
      No properties yet
    </div>
  {:else}
    <div class="bg-card border border-border rounded-xl overflow-hidden">
      {#each properties as property, i}
        <div class="px-4 py-3 {i !== 0 ? 'border-t border-border' : ''}">
          <!-- Línea 1: dirección -->
          <a href="/customers/{customer.id}/properties/{property.id}" class="text-sm font-medium text-text hover:text-primary transition-colors">
            {property.address}
          </a>
          <p class="text-xs text-muted mt-0.5">
            {[property.suburb, property.state, property.postcode].filter(Boolean).join(' ')}
          </p>
          <!-- Línea 2: badges + botones -->
          <div class="flex items-center justify-between mt-2">
            <div class="flex items-center gap-2">
              {#if property.pool_type}
                <span class="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                  {property.pool_type}
                </span>
              {/if}
              {#if property.pool_volume_litres}
                <span class="text-xs text-muted">{property.pool_volume_litres.toLocaleString()}L</span>
              {/if}
            </div>
            <div class="flex items-center gap-1">
              <a
                href="/customers/{customer.id}/properties/{property.id}/edit"
                class="p-2 text-muted hover:text-text border border-border rounded-lg hover:bg-surface transition-colors"
                title="Edit property"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </a>
              {#if confirmDeletePropertyId === property.id}
                <form method="POST" action="?/deleteProperty" use:enhance={() => {
                  return async ({ update }) => { await update() }
                }} class="flex items-center gap-1">
                  <input type="hidden" name="propertyId" value={property.id} />
                  <button type="submit" class="text-xs px-2 py-1.5 bg-danger text-white rounded-lg hover:opacity-90">
                    Yes
                  </button>
                  <button type="button" onclick={() => confirmDeletePropertyId = null}
                    class="text-xs px-2 py-1.5 border border-border rounded-lg hover:bg-surface">
                    No
                  </button>
                </form>
              {:else}
                <button
                  onclick={() => confirmDeletePropertyId = property.id}
                  class="p-2 text-muted hover:text-danger border border-border rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete property"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>