<script lang="ts">
  import { enhance } from '$app/forms'
  import type { PageData } from './$types'
  import { PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public'
import { onMount } from 'svelte'

let addressInput: HTMLInputElement

  let { data }: { data: PageData } = $props()
  let { member, plans, pendingVisits } = $derived(data)

  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  let editing = $state(false)
  let editName = $state(member.name ?? '')
  let editEmail = $state(member.email ?? '')
  let editPhone = $state(member.phone ?? '')
  let editAddress = $state(member.address ?? '')
  let editWorkingDays = $state<number[]>(member.working_days ?? [1,2,3,4,5])
  let saving = $state(false)

  let showAway = $state(false)
  let awayFrom = $state('')
  let awayTo = $state('')
  let savingAway = $state(false)

  let showDeactivate = $state(false)
  let deactivating = $state(false)

  $effect(() => {
    editName = member.name ?? ''
    editEmail = member.email ?? ''
    editPhone = member.phone ?? ''
    editAddress = member.address ?? ''
    editWorkingDays = member.working_days ?? [1,2,3,4,5]
  })

  function initAutocomplete() {
  if (!addressInput) return
  const autocomplete = new (window as any).google.maps.places.Autocomplete(addressInput, {
    componentRestrictions: { country: 'au' },
    fields: ['formatted_address'],
    types: ['address']
  })
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace()
    if (place.formatted_address) {
      editAddress = place.formatted_address
    }
  })
}

function loadMaps() {
  if ((window as any).google?.maps?.places) {
    initAutocomplete()
    return
  }
  ;(window as any).initTeamMaps = initAutocomplete
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${PUBLIC_GOOGLE_MAPS_KEY}&libraries=places&callback=initTeamMaps`
  script.async = true
  script.defer = true
  document.head.appendChild(script)
}
</script>

<div class="max-w-2xl">
  <!-- Header -->
  <div class="mb-6">
    <a href="/settings/team" class="text-sm text-muted hover:text-text transition-colors">← Team</a>
    <div class="flex items-center justify-between mt-2">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span class="text-primary font-medium text-lg">{member.name?.charAt(0).toUpperCase() ?? '?'}</span>
        </div>
        <div>
          <h1 class="text-xl font-semibold text-text">{member.name}</h1>
          <p class="text-sm text-muted">{member.email}</p>
        </div>
      </div>
      
<button onclick={() => { editing = !editing; if (!editing) return; setTimeout(() => loadMaps(), 50) }}
  class="p-2 border border-border rounded-lg text-muted hover:text-text hover:bg-surface transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  </div>

  <!-- Edit form -->
  {#if editing}
    <div class="bg-card border border-border rounded-xl p-4 mb-6">
      <h2 class="text-sm font-medium text-text mb-3">Edit details</h2>
      <form method="POST" action="?/updateMember" use:enhance={() => {
        saving = true
        return async ({ update }) => { await update(); saving = false; editing = false }
      }}>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-muted mb-1">Name</label>
            <input type="text" name="name" bind:value={editName}
              class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label class="block text-xs text-muted mb-1">Email</label>
            <input type="email" name="email" bind:value={editEmail}
              class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label class="block text-xs text-muted mb-1">Phone</label>
            <input type="text" name="phone" bind:value={editPhone} placeholder="0400 000 000"
              class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label class="block text-xs text-muted mb-1">Address</label>
            <input type="text" name="address" bind:value={editAddress} bind:this={addressInput}
  placeholder="123 Main St, Suburb"
  class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label class="block text-xs text-muted mb-2">Working days</label>
            <div class="flex gap-1.5 flex-wrap">
              {#each dayLabels as label, d}
                <label class="cursor-pointer">
                  <input type="checkbox" name="working_days" value={d}
                    checked={editWorkingDays.includes(d)}
                    onchange={() => {
                      editWorkingDays = editWorkingDays.includes(d)
                        ? editWorkingDays.filter(x => x !== d)
                        : [...editWorkingDays, d].sort()
                    }}
                    class="sr-only" />
                  <span class="inline-block px-2.5 py-1 text-xs rounded-lg border transition-colors
                    {editWorkingDays.includes(d) ? 'bg-primary text-white border-primary' : 'border-border text-muted hover:bg-surface'}">
                    {label}
                  </span>
                </label>
              {/each}
            </div>
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button type="submit" disabled={saving}
            class="flex-1 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onclick={() => editing = false}
            class="py-2 px-4 border border-border text-sm rounded-lg hover:bg-surface transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>

  {:else}
    <!-- Details view -->
    <div class="bg-card border border-border rounded-xl divide-y divide-border mb-6">
      {#if member.phone}
        <div class="px-4 py-3 flex gap-4">
          <span class="text-sm text-muted w-24 flex-shrink-0">Phone</span>
          <span class="text-sm text-text">{member.phone}</span>
        </div>
      {/if}
      {#if member.address}
        <div class="px-4 py-3 flex gap-4">
          <span class="text-sm text-muted w-24 flex-shrink-0">Address</span>
          <span class="text-sm text-text">{member.address}</span>
        </div>
      {/if}
      <div class="px-4 py-3 flex gap-4">
        <span class="text-sm text-muted w-24 flex-shrink-0">Role</span>
        <span class="text-sm text-text capitalize">{member.role}</span>
      </div>
      {#if member.working_days?.length}
        <div class="px-4 py-3 flex gap-4">
          <span class="text-sm text-muted w-24 flex-shrink-0">Works</span>
          <span class="text-sm text-text">
            {(member.working_days as number[]).map((d: number) => dayLabels[d]).join(', ')}
          </span>
        </div>
      {/if}
      <div class="px-4 py-3 flex gap-4">
        <span class="text-sm text-muted w-24 flex-shrink-0">Properties</span>
        <span class="text-sm text-text">{plans.length} assigned</span>
      </div>
      <div class="px-4 py-3 flex gap-4">
        <span class="text-sm text-muted w-24 flex-shrink-0">Pending</span>
        <span class="text-sm text-text">{pendingVisits} upcoming visits</span>
      </div>
    </div>
  {/if}

  <!-- Assigned properties -->
  <div class="mb-6">
    <h2 class="text-base font-medium text-text mb-3">Assigned properties ({plans.length})</h2>
    {#if plans.length === 0}
      <div class="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted">
        No properties assigned
      </div>
    {:else}
      <div class="bg-card border border-border rounded-xl overflow-hidden">
        {#each plans as plan, i}
          <a href="/customers/{plan.properties?.customers?.id}/properties/{plan.properties?.id}"
            class="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors {i !== 0 ? 'border-t border-border' : ''}">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text truncate">{plan.properties?.customers?.name ?? '—'}</p>
              <p class="text-xs text-muted truncate">{plan.properties?.address}{#if plan.properties?.suburb}, {plan.properties.suburb}{/if}</p>
            </div>
            <span class="text-xs text-muted capitalize flex-shrink-0">
              {plan.recurrence} · {dayLabels[plan.preferred_day_of_week]}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" class="text-muted flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Actions -->
  <div class="space-y-3">
    <!-- Mark as away -->
    <div class="bg-card border border-border rounded-xl overflow-hidden">
      <button type="button" onclick={() => showAway = !showAway}
        class="w-full flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div class="text-left">
            <p class="text-sm font-medium text-text">Mark as away</p>
            <p class="text-xs text-muted">Skip visits for a date range</p>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"
          class="text-muted transition-transform {showAway ? 'rotate-180' : ''}"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {#if showAway}
        <div class="px-4 pb-4 border-t border-border">
          <p class="text-xs text-muted mt-3 mb-3">All pending visits in this range will be marked as skipped. You can reassign them manually afterwards.</p>
          <form method="POST" action="?/markAway" use:enhance={() => {
            savingAway = true
            return async ({ update }) => { await update(); savingAway = false; showAway = false }
          }}>
            <div class="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label class="block text-xs text-muted mb-1">From</label>
                <input type="date" name="fromDate" bind:value={awayFrom} required
                  class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label class="block text-xs text-muted mb-1">To</label>
                <input type="date" name="toDate" bind:value={awayTo} required
                  class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <button type="submit" disabled={savingAway || !awayFrom || !awayTo}
              class="w-full py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50">
              {savingAway ? 'Saving…' : 'Confirm away period'}
            </button>
          </form>
        </div>
      {/if}
    </div>

    <!-- Deactivate account -->
    {#if member.role !== 'admin'}
      <div class="bg-card border border-red-200 rounded-xl overflow-hidden">
        <button type="button" onclick={() => showDeactivate = !showDeactivate}
          class="w-full flex items-center justify-between px-4 py-3 hover:bg-red-50 transition-colors">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <div class="text-left">
              <p class="text-sm font-medium text-danger">Deactivate account</p>
              <p class="text-xs text-muted">Reassign all properties and disable login</p>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"
            class="text-muted transition-transform {showDeactivate ? 'rotate-180' : ''}"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        {#if showDeactivate}
          <div class="px-4 pb-4 border-t border-red-200 bg-red-50">
            <div class="mt-3 mb-4 space-y-1.5">
              <p class="text-sm font-medium text-danger">Are you sure?</p>
              <p class="text-xs text-muted">This will permanently:</p>
              <ul class="text-xs text-muted space-y-1 ml-3">
                <li>· Reassign all {plans.length} propert{plans.length !== 1 ? 'ies' : 'y'} to you</li>
                <li>· Regenerate future visits under your name</li>
                <li>· Disable {member.name}'s login</li>
              </ul>
              <p class="text-xs text-muted mt-2">You can reassign properties later from <a href="/customers/map" class="text-primary underline">Properties map</a>.</p>
            </div>
            <form method="POST" action="?/deactivate" use:enhance={() => {
              deactivating = true
              return async ({ update }) => { await update(); deactivating = false }
            }}>
              <div class="flex gap-2">
                <button type="submit" disabled={deactivating}
                  class="flex-1 py-2 bg-danger text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-50">
                  {deactivating ? 'Deactivating…' : 'Yes, deactivate'}
                </button>
                <button type="button" onclick={() => showDeactivate = false}
                  class="py-2 px-4 border border-border bg-white text-sm rounded-lg hover:bg-surface transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>