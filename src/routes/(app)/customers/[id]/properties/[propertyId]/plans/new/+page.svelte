<script lang="ts">
  import { enhance } from '$app/forms'
  import type { PageData, ActionData } from './$types'

  let { data, form }: { data: PageData, form: ActionData } = $props()
  let loading = $state(false)
  let { property, customer, technicians } = $derived(data)

  const days = [
    { value: 0, label: 'Monday' },
    { value: 1, label: 'Tuesday' },
    { value: 2, label: 'Wednesday' },
    { value: 3, label: 'Thursday' },
    { value: 4, label: 'Friday' },
    { value: 5, label: 'Saturday' },
    { value: 6, label: 'Sunday' },
  ]

  const today = new Date().toISOString().split('T')[0]
</script>

<div class="max-w-lg">
  <div class="mb-6">
    <a href="/customers/{customer?.id}/properties/{property?.id}" class="text-sm text-muted hover:text-text transition-colors">
      ← {property?.address}
    </a>
    <h1 class="text-2xl font-semibold text-text mt-2">New service plan</h1>
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
          <label for="recurrence" class="block text-sm font-medium text-text mb-1">Recurrence</label>
          <select id="recurrence" name="recurrence" required
            class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="preferred_day_of_week" class="block text-sm font-medium text-text mb-1">Preferred day</label>
            <select id="preferred_day_of_week" name="preferred_day_of_week" required
              class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
              {#each days as day}
                <option value={day.value}>{day.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="preferred_time" class="block text-sm font-medium text-text mb-1">Preferred time</label>
            <select id="preferred_time" name="preferred_time" required
              class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
              {#each [
                '06:00','06:30','07:00','07:30','08:00','08:30',
                '09:00','09:30','10:00','10:30','11:00','11:30',
                '12:00','12:30','13:00','13:30','14:00','14:30',
                '15:00','15:30','16:00','16:30','17:00','17:30','18:00'
              ] as t}
                {@const [h, m] = t.split(':').map(Number)}
                {@const ampm = h < 12 ? 'AM' : 'PM'}
                {@const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h}
                <option value={t} selected={t === '09:00'}>
                  {h12}:{String(m).padStart(2,'0')} {ampm}
                </option>
              {/each}
            </select>
          </div>
        </div>

        <div>
          <label for="start_date" class="block text-sm font-medium text-text mb-1">Start date</label>
          <input id="start_date" name="start_date" type="date" required
            value={today}
            class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
        </div>

        {#if technicians.length > 0}
          <div>
            <label for="technician_id" class="block text-sm font-medium text-text mb-1">Technician</label>
            <select id="technician_id" name="technician_id" required
              class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
              {#each technicians as tech}
                <option value={tech.id}>{tech.name}</option>
              {/each}
            </select>
          </div>
        {/if}

        <div>
          <label for="notes" class="block text-sm font-medium text-text mb-1">Notes</label>
          <textarea id="notes" name="notes" rows="2"
            class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            placeholder="Any notes for this service plan..."
          ></textarea>
        </div>

        <!-- Pool equipment -->
        <div class="border-t border-border pt-4">
          <p class="text-sm font-medium text-text mb-3">Pool equipment</p>
          <div class="space-y-3">
            <div>
              <label for="pump" class="block text-xs font-medium text-muted mb-1">Pump</label>
              <input id="pump" name="pump" type="text"
                class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g. Pentair WhisperFlo 1.5HP" />
            </div>
            <div>
              <label for="filter" class="block text-xs font-medium text-muted mb-1">Filter</label>
              <input id="filter" name="filter" type="text"
                class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g. Hayward Pro-Series Sand Filter" />
            </div>
            <div>
              <label for="chlorinator" class="block text-xs font-medium text-muted mb-1">Chlorinator</label>
              <input id="chlorinator" name="chlorinator" type="text"
                class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g. Zodiac LM2-24 Salt Chlorinator" />
            </div>
          </div>
        </div>

        <p class="text-xs text-muted">
          Visits will be automatically generated for the next 6 weeks.
        </p>

        <div class="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            class="flex-1 py-2 px-4 rounded-lg bg-primary text-white text-sm font-medium
                   hover:bg-primary-dark transition-colors disabled:opacity-50">
            {loading ? 'Creating…' : 'Create plan'}
          </button>
          <a href="/customers/{customer?.id}/properties/{property?.id}"
            class="py-2 px-4 rounded-lg border border-border text-text text-sm font-medium
                   hover:bg-surface transition-colors">
            Cancel
          </a>
        </div>
      </div>
    </form>
  </div>
</div>