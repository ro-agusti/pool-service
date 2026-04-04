<script lang="ts">
  import { enhance } from '$app/forms'
  import { onMount } from 'svelte'
  import { PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public'
  import type { PageData, ActionData } from './$types'

  let { data, form }: { data: PageData, form: ActionData } = $props()
  let loading = $state(false)
  let { property, customer } = $derived(data)

  let addressInput: HTMLInputElement
  let suburbInput: HTMLInputElement
  let stateSelect: HTMLSelectElement
  let postcodeInput: HTMLInputElement

  onMount(() => {
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
  })

  function initAutocomplete() {
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
          case 'administrative_area_level_1':
            const stateMap: Record<string, string> = {
              'New South Wales': 'NSW', 'Victoria': 'VIC', 'Queensland': 'QLD',
              'Western Australia': 'WA', 'South Australia': 'SA', 'Tasmania': 'TAS',
              'Australian Capital Territory': 'ACT', 'Northern Territory': 'NT'
            }
            stateSelect.value = stateMap[component.long_name] ?? component.short_name
            break
          case 'postal_code': postcodeInput.value = component.long_name; break
        }
      }
      if (streetNumber || streetName) {
        addressInput.value = `${streetNumber} ${streetName}`.trim()
      }
    })
  }
</script>

<div class="max-w-lg">
  <div class="mb-6">
    <a href="/customers/{customer?.id}" class="text-sm text-muted hover:text-text transition-colors">← {customer?.name}</a>
    <h1 class="text-2xl font-semibold text-text mt-2">Edit property</h1>
  </div>

  <div class="bg-card border border-border rounded-xl p-6">
    {#if form?.error}
      <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
        {form.error}
      </div>
    {/if}

    <form method="POST" use:enhance={() => {
      loading = true
      return async ({ update }) => { await update(); loading = false }
    }}>
      <div class="space-y-4">
        <div>
          <label for="address" class="block text-sm font-medium text-text mb-1">
            Street address <span class="text-danger">*</span>
          </label>
          <input
            id="address" name="address" type="text" required
            bind:this={addressInput}
            value={form?.address ?? property.address}
            class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="suburb" class="block text-sm font-medium text-text mb-1">Suburb</label>
            <input
              id="suburb" name="suburb" type="text"
              bind:this={suburbInput}
              value={form?.suburb ?? property.suburb ?? ''}
              class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label for="state" class="block text-sm font-medium text-text mb-1">State</label>
            <select
              id="state" name="state"
              bind:this={stateSelect}
              class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {#each ['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'] as s}
                <option value={s} selected={(form?.state ?? property.state) === s}>{s}</option>
              {/each}
            </select>
          </div>
        </div>

        <div>
          <label for="postcode" class="block text-sm font-medium text-text mb-1">Postcode</label>
          <input
            id="postcode" name="postcode" type="text" maxlength="4"
            bind:this={postcodeInput}
            value={form?.postcode ?? property.postcode ?? ''}
            class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="pool_type" class="block text-sm font-medium text-text mb-1">Pool type</label>
            <select
              id="pool_type" name="pool_type"
              class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">— Select —</option>
              {#each ['concrete','fibreglass','vinyl'] as t}
                <option value={t} selected={(form?.pool_type ?? property.pool_type) === t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              {/each}
            </select>
          </div>
          <div>
            <label for="pool_volume_litres" class="block text-sm font-medium text-text mb-1">Volume (L)</label>
            <input
              id="pool_volume_litres" name="pool_volume_litres" type="number" min="0"
              value={property.pool_volume_litres ?? ''}
              class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label for="notes" class="block text-sm font-medium text-text mb-1">Notes</label>
          <textarea
            id="notes" name="notes" rows="2"
            class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          >{form?.notes ?? property.notes ?? ''}</textarea>
        </div>

        <p class="text-xs text-muted">📍 Coordinates will be re-detected from the updated address</p>

        <div class="flex gap-3 pt-2">
          <button
            type="submit" disabled={loading}
            class="flex-1 py-2 px-4 rounded-lg bg-primary text-white text-sm font-medium
                   hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
          <a
            href="/customers/{customer?.id}"
            class="py-2 px-4 rounded-lg border border-border text-text text-sm font-medium
                   hover:bg-surface transition-colors"
          >
            Cancel
          </a>
        </div>
      </div>
    </form>
  </div>
</div>