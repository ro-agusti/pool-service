<script lang="ts">
  import { enhance } from '$app/forms'
  import { createClient } from '@supabase/supabase-js'
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  let { orgSettings } = $derived(data)

  let editing = $state(!orgSettings)
  let saving = $state(false)
  let saved = $state(false)
  let uploadingLogo = $state(false)
  let logoUrl = $state(orgSettings?.logo_url ?? '')

  let addressInput: HTMLInputElement
  let suburbInput: HTMLInputElement
  let stateSelect: HTMLSelectElement
  let postcodeInput: HTMLInputElement

  onMount(() => {
    if (!editing) return
    initMaps()
  })

  function initMaps() {
    if ((window as any).google?.maps?.places) {
      initAutocomplete()
      return
    }
    ;(window as any).initGooglePlaces = initAutocomplete
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${PUBLIC_GOOGLE_MAPS_KEY}&libraries=places&callback=initGooglePlaces`
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }

  function initAutocomplete() {
    if (!addressInput) return
    const autocomplete = new (window as any).google.maps.places.Autocomplete(addressInput, {
      componentRestrictions: { country: 'au' },
      fields: ['address_components'],
      types: ['address']
    })
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.address_components) return
      let streetNumber = ''
      let streetName = ''
      for (const component of place.address_components) {
        const type = component.types[0]
        switch (type) {
          case 'street_number': streetNumber = component.long_name; break
          case 'route': streetName = component.long_name; break
          case 'locality': suburbInput.value = component.long_name; break
          case 'administrative_area_level_1': {
            const stateMap: Record<string, string> = {
              'New South Wales': 'NSW', 'Victoria': 'VIC', 'Queensland': 'QLD',
              'Western Australia': 'WA', 'South Australia': 'SA', 'Tasmania': 'TAS',
              'Australian Capital Territory': 'ACT', 'Northern Territory': 'NT'
            }
            stateSelect.value = stateMap[component.long_name] ?? component.short_name
            break
          }
          case 'postal_code': postcodeInput.value = component.long_name; break
        }
      }
      if (streetNumber || streetName) {
        addressInput.value = `${streetNumber} ${streetName}`.trim()
      }
    })
  }

  function startEditing() {
    editing = true
    setTimeout(() => initMaps(), 50)
  }

  async function handleLogoUpload(e: Event) {
    const input = e.target as HTMLInputElement
    if (!input.files?.length) return
    uploadingLogo = true
    const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
    const file = input.files[0]
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `logos/${Date.now()}-${safeName}`
    const { data: uploaded, error } = await supabase.storage
      .from('visit-photos')
      .upload(path, file, { upsert: true })
    if (!error && uploaded) {
      const { data: { publicUrl } } = supabase.storage.from('visit-photos').getPublicUrl(uploaded.path)
      logoUrl = publicUrl
    }
    uploadingLogo = false
    input.value = ''
  }
</script>

<div class="max-w-2xl">
  <div class="mb-6">
    <a href="/settings" class="text-sm text-muted hover:text-text transition-colors">← Settings</a>
    <div class="flex items-center justify-between mt-2">
      <h1 class="text-xl font-semibold text-text">Business details</h1>
      {#if orgSettings && !editing}
        <button onclick={startEditing}
          class="flex items-center gap-1.5 text-sm text-primary hover:underline">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
      {/if}
    </div>
  </div>

  {#if !editing && orgSettings}
    <!-- View mode -->
    <div class="bg-card border border-border rounded-xl overflow-hidden">
      {#if orgSettings.logo_url}
        <div class="px-4 py-4 border-b border-border">
          <img src={orgSettings.logo_url} alt="Business logo" class="h-12 object-contain" />
        </div>
      {/if}
      {#each [
        { label: 'Business name', value: orgSettings.business_name },
        { label: 'ABN',           value: orgSettings.abn },
        { label: 'Phone',         value: orgSettings.phone },
        { label: 'Email',         value: orgSettings.email },
        { label: 'Address',       value: [orgSettings.address, orgSettings.suburb, orgSettings.state, orgSettings.postcode].filter(Boolean).join(', ') },
      ] as row}
        {#if row.value}
          <div class="px-4 py-3 flex gap-4 border-b border-border last:border-0">
            <span class="text-sm text-muted w-32 flex-shrink-0">{row.label}</span>
            <span class="text-sm text-text">{row.value}</span>
          </div>
        {/if}
      {/each}
    </div>

  {:else}
    <!-- Edit mode -->
    <form method="POST" action="?/save" use:enhance={() => {
      saving = true; saved = false
      return async ({ update }) => {
        await update()
        saving = false; saved = true; editing = false
        setTimeout(() => saved = false, 2000)
      }
    }}>
      <input type="hidden" name="logo_url" value={logoUrl} />

      <div class="bg-card border border-border rounded-xl p-4 space-y-3">

        <!-- Logo -->
        <div>
          <p class="text-xs font-medium text-muted mb-2">Logo</p>
          <div class="flex items-center gap-3">
            {#if logoUrl}
              <img src={logoUrl} alt="Logo" class="h-12 object-contain rounded-lg border border-border" />
            {:else}
              <div class="w-12 h-12 rounded-lg border border-dashed border-border bg-surface flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
            {/if}
            <label class="cursor-pointer">
              <span class="text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors">
                {uploadingLogo ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}
              </span>
              <input type="file" accept="image/*" class="hidden" onchange={handleLogoUpload} disabled={uploadingLogo} />
            </label>
            {#if logoUrl}
              <button type="button" onclick={() => logoUrl = ''}
                class="text-xs text-muted hover:text-danger transition-colors">Remove</button>
            {/if}
          </div>
        </div>

        <!-- Business name -->
        <div>
          <label class="block text-xs font-medium text-muted mb-1">Business name</label>
          <input name="business_name" type="text" value={orgSettings?.business_name ?? ''}
            placeholder="Clearwave Pool Services"
            class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <!-- ABN -->
        <div>
          <label class="block text-xs font-medium text-muted mb-1">ABN</label>
          <input name="abn" type="text" value={orgSettings?.abn ?? ''}
            placeholder="12 345 678 901"
            class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <!-- Phone + Email -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-muted mb-1">Phone</label>
            <input name="phone" type="text" value={orgSettings?.phone ?? ''}
              placeholder="0400 000 000"
              class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted mb-1">Email</label>
            <input name="email" type="email" value={orgSettings?.email ?? ''}
              placeholder="hello@business.com.au"
              class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <!-- Address with autocomplete -->
        <div>
          <label class="block text-xs font-medium text-muted mb-1">Address</label>
          <input name="address" type="text"
            bind:this={addressInput}
            value={orgSettings?.address ?? ''}
            placeholder="Start typing an address…"
            class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <!-- Suburb + State + Postcode -->
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-medium text-muted mb-1">Suburb</label>
            <input name="suburb" type="text"
              bind:this={suburbInput}
              value={orgSettings?.suburb ?? ''}
              placeholder="Manly"
              class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted mb-1">State</label>
            <select name="state"
              bind:this={stateSelect}
              class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary">
              {#each ['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'] as s}
                <option value={s} selected={orgSettings?.state === s}>{s}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-muted mb-1">Postcode</label>
            <input name="postcode" type="text" maxlength="4"
              bind:this={postcodeInput}
              value={orgSettings?.postcode ?? ''}
              placeholder="2095"
              class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
      </div>

      <div class="flex gap-3 mt-3">
        {#if orgSettings}
          <button type="button" onclick={() => editing = false}
            class="flex-1 py-2.5 border border-border text-sm text-muted rounded-xl hover:bg-surface transition-colors">
            Cancel
          </button>
        {/if}
        <button type="submit" disabled={saving}
          class="flex-1 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </form>
  {/if}
</div>