<script lang="ts">
  import { goto } from '$app/navigation'
  import type { PageData } from './$types'
  import { page } from '$app/state'

  let { data }: { data: PageData } = $props()
  let search = $state(data.search)
  let debounce: ReturnType<typeof setTimeout>
  let isAdmin = $derived(page.data.user?.role === 'admin')

  function onSearch(e: Event) {
    search = (e.target as HTMLInputElement).value
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      goto(`?search=${search}`, { keepFocus: true, replaceState: true })
    }, 300)
  }
</script>

<div class="max-w-2xl">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-semibold text-text">Customers</h1>
      <p class="text-sm text-muted">{data.customers.length} total</p>
    </div>
    <div class="flex items-center gap-2">
      {#if isAdmin}
        <a href="/customers/map"
          class="p-2 border border-border rounded-lg text-muted hover:text-text hover:bg-surface transition-colors"
          title="Properties map">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
        </a>
        <a href="/customers/new"
          class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
          + New customer
        </a>
      {/if}
    </div>
  </div>

  <!-- Search -->
  <div class="mb-4">
    <input
      type="search"
      placeholder="Search customers..."
      value={search}
      oninput={onSearch}
      class="w-full md:w-80 px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
             focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
    />
  </div>

  <!-- List -->
  {#if data.customers.length === 0}
    <div class="text-center py-16 text-muted">
      <p class="text-lg mb-1">No customers yet</p>
      <p class="text-sm">Add your first customer to get started</p>
    </div>
  {:else}
    <div class="bg-card border border-border rounded-xl overflow-hidden">
      {#each data.customers as customer, i}
        <a
          href="/customers/{customer.id}"
          class="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors
                 {i !== 0 ? 'border-t border-border' : ''}"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span class="text-primary text-sm font-medium">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p class="text-sm font-medium text-text">{customer.name}</p>
              <p class="text-xs text-muted">{customer.email ?? '—'}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            {#if customer.phone}
              <span class="text-sm text-muted hidden md:block">{customer.phone}</span>
            {/if}
            <svg class="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>