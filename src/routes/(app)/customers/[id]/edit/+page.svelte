<script lang="ts">
  import { enhance } from '$app/forms'
  import type { PageData, ActionData } from './$types'

  let { data, form }: { data: PageData, form: ActionData } = $props()
  let loading = $state(false)
  let { customer } = $derived(data)
</script>

<div class="max-w-lg">
  <div class="mb-6">
    <a href="/customers/{customer.id}" class="text-sm text-muted hover:text-text transition-colors">← {customer.name}</a>
    <h1 class="text-2xl font-semibold text-text mt-2">Edit customer</h1>
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
          <label for="name" class="block text-sm font-medium text-text mb-1">
            Full name <span class="text-danger">*</span>
          </label>
          <input
            id="name" name="name" type="text" required
            value={form?.name ?? customer.name}
            class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label for="email" class="block text-sm font-medium text-text mb-1">Email</label>
          <input
            id="email" name="email" type="email"
            value={form?.email ?? customer.email ?? ''}
            class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label for="phone" class="block text-sm font-medium text-text mb-1">Phone</label>
          <input
            id="phone" name="phone" type="tel"
            value={form?.phone ?? customer.phone ?? ''}
            class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label for="notes" class="block text-sm font-medium text-text mb-1">Notes</label>
          <textarea
            id="notes" name="notes" rows="3"
            class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
          >{form?.notes ?? customer.notes ?? ''}</textarea>
        </div>

        <div class="flex gap-3 pt-2">
          <button
            type="submit" disabled={loading}
            class="flex-1 py-2 px-4 rounded-lg bg-primary text-white text-sm font-medium
                   hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
          <a
            href="/customers/{customer.id}"
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