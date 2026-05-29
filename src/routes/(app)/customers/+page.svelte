<!-- src/routes/(app)/customers/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { enhance } from '$app/forms'
  import type { PageData } from './$types'
  import { page } from '$app/state'

  let { data, form }: { data: PageData; form: any } = $props()
  let search = $state(data.search)
  let debounce: ReturnType<typeof setTimeout>
  let isAdmin = $derived(page.data.user?.role === 'admin')

  // Xero import state
  let showXeroBanner = $state((data.newXeroContacts?.length ?? 0) > 0)
  let selectedIds = $state<Set<string>>(new Set())
  let importing = $state(false)

  // After successful import, hide banner
  $effect(() => {
    if (form?.imported) showXeroBanner = false
  })

  function toggleContact(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds = next
  }

  function selectAll() {
    selectedIds = new Set(data.newXeroContacts?.map((c: any) => c.xeroId) ?? [])
  }

  function selectNone() {
    selectedIds = new Set()
  }

  function onSearch(e: Event) {
    search = (e.target as HTMLInputElement).value
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      goto(`?search=${search}`, { keepFocus: true, replaceState: true })
    }, 300)
  }

  function getContactMaps() {
    const names: Record<string, string> = {}
    const emails: Record<string, string | null> = {}
    const phones: Record<string, string | null> = {}
    for (const c of data.newXeroContacts ?? []) {
      names[c.xeroId] = c.name
      emails[c.xeroId] = c.email
      phones[c.xeroId] = c.phone
    }
    return { names, emails, phones }
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

  <!-- Xero new contacts banner -->
  {#if isAdmin && showXeroBanner && data.newXeroContacts?.length > 0}
    <div class="mb-5 bg-white border border-[#13B5EA] rounded-xl overflow-hidden">
      <!-- Banner header -->
      <div class="flex items-center justify-between px-4 py-3 bg-sky-50 border-b border-[#13B5EA]/30">
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 rounded bg-[#13B5EA] flex items-center justify-center flex-shrink-0">
            <span class="text-white text-[10px] font-bold leading-none">X</span>
          </div>
          <p class="text-sm font-medium text-slate-800">
            {data.newXeroContacts.length} new {data.newXeroContacts.length === 1 ? 'contact' : 'contacts'} found in Xero
          </p>
        </div>
        <button onclick={() => showXeroBanner = false}
          class="text-slate-400 hover:text-slate-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- Contact list -->
      <div class="divide-y divide-border max-h-64 overflow-y-auto">
        {#each data.newXeroContacts as contact}
          <label class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={selectedIds.has(contact.xeroId)}
              onchange={() => toggleContact(contact.xeroId)}
              class="w-4 h-4 rounded border-border text-primary accent-primary"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text truncate">{contact.name}</p>
              <p class="text-xs text-muted truncate">{contact.email ?? '—'}{contact.phone ? ' · ' + contact.phone : ''}</p>
            </div>
          </label>
        {/each}
      </div>

      <!-- Actions -->
      <div class="px-4 py-3 border-t border-border flex items-center justify-between gap-3 bg-surface/50">
        <div class="flex items-center gap-3">
          <button onclick={selectAll} class="text-xs text-primary hover:underline">Select all</button>
          <button onclick={selectNone} class="text-xs text-muted hover:underline">None</button>
          <span class="text-xs text-muted">{selectedIds.size} selected</span>
        </div>

        {#if selectedIds.size > 0}
          {@const { names, emails, phones } = getContactMaps()}
          <form method="POST" action="?/importXeroContacts" use:enhance={() => {
            importing = true
            return async ({ update }) => {
              await update()
              importing = false
            }
          }}>
            <!-- Pass selected IDs -->
            {#each [...selectedIds] as id}
              <input type="hidden" name="contactIds" value={id} />
            {/each}
            <!-- Pass all contact data as JSON maps -->
            <input type="hidden" name="contactNames" value={JSON.stringify(names)} />
            <input type="hidden" name="contactEmails" value={JSON.stringify(emails)} />
            <input type="hidden" name="contactPhones" value={JSON.stringify(phones)} />

            <button type="submit" disabled={importing}
              class="px-4 py-2 bg-[#13B5EA] text-white text-sm font-medium rounded-lg hover:bg-[#0EA0D0] transition-colors disabled:opacity-50 flex items-center gap-2">
              {#if importing}
                <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                Importing…
              {:else}
                Import {selectedIds.size} {selectedIds.size === 1 ? 'contact' : 'contacts'}
              {/if}
            </button>
          </form>
        {/if}
      </div>
    </div>

    <!-- Success message -->
    {#if form?.imported}
      <div class="mb-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        {form.imported} {form.imported === 1 ? 'contact' : 'contacts'} imported successfully.
      </div>
    {/if}
  {/if}

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
              <div class="flex items-center gap-1.5">
                <p class="text-sm font-medium text-text">{customer.name}</p>
                {#if customer.xero_contact_id}
                  <div class="w-3.5 h-3.5 rounded bg-[#13B5EA] flex items-center justify-center" title="Linked to Xero">
                    <span class="text-white text-[8px] font-bold leading-none">X</span>
                  </div>
                {/if}
              </div>
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