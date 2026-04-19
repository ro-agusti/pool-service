<script lang="ts">
  import { enhance } from '$app/forms'
  import { page } from '$app/state'
  import type { PageData, ActionData } from './$types'

  let { data, form }: { data: PageData, form: ActionData } = $props()
  let { team } = $derived(data)

  let showForm = $state(false)
  let name = $state('')
  let email = $state('')
  let password = $state('')
  let showPassword = $state(false)
  let confirmDeleteId = $state<string | null>(null)
  let loading = $state(false)

  const currentUserId = $derived(page.data.user?.id)

  function cancelForm() {
    showForm = false
    name = ''; email = ''; password = ''
  }

  const roleColors: Record<string, string> = {
    admin:      'bg-violet-50 text-violet-600 border-violet-200',
    technician: 'bg-sky-50 text-sky-600 border-sky-200',
  }
</script>

<div class="max-w-2xl">
  <div class="flex items-center justify-between mb-6">
    <div>
      <a href="/settings" class="text-sm text-muted hover:text-text transition-colors">← Settings</a>
      <h1 class="text-xl font-semibold text-text mt-1">Team</h1>
      <p class="text-sm text-muted">Manage technicians in your organisation</p>
    </div>
    {#if !showForm}
      <button onclick={() => showForm = true}
        class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
        + Add technician
      </button>
    {/if}
  </div>

  <!-- Error from action -->
  {#if form?.error}
    <div class="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-danger">
      {form.error}
    </div>
  {/if}

  <!-- Add technician form -->
  {#if showForm}
    <div class="bg-card border border-border rounded-xl p-4 mb-6">
      <h2 class="text-sm font-medium text-text mb-4">New technician</h2>
      <form method="POST" action="?/createTechnician" use:enhance={() => {
        loading = true
        return async ({ update, result }) => {
          await update()
          loading = false
          if (result.type === 'success') cancelForm()
        }
      }}>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-muted mb-1">Full name</label>
            <input type="text" name="name" bind:value={name} placeholder="e.g. James Smith"
              class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div>
            <label class="block text-xs text-muted mb-1">Email</label>
            <input type="email" name="email" bind:value={email} placeholder="james@example.com"
              class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary" required />
          </div>
          <div>
            <label class="block text-xs text-muted mb-1">Temporary password</label>
            <div class="relative">
              <input type={showPassword ? 'text' : 'password'} name="password" bind:value={password}
                placeholder="Min. 6 characters"
                class="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary pr-10" required />
              <button type="button" onclick={() => showPassword = !showPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors">
                {#if showPassword}
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {/if}
              </button>
            </div>
            <p class="text-xs text-muted mt-1">Share this with the technician — they can reset it later</p>
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button type="submit" disabled={loading}
            class="flex-1 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
            {loading ? 'Creating…' : 'Create technician'}
          </button>
          <button type="button" onclick={cancelForm}
            class="py-2 px-4 border border-border text-sm rounded-lg hover:bg-surface transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Team list -->
  {#if team.length === 0}
    <div class="bg-card border border-border rounded-xl p-8 text-center text-muted text-sm">
      No team members yet
    </div>
  {:else}
    <div class="bg-card border border-border rounded-xl overflow-hidden">
      {#each team as member, i}
  <div class="px-4 py-3 flex items-center gap-3 {i !== 0 ? 'border-t border-border' : ''}">
    <a href="/settings/team/{member.id}" class="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
      <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span class="text-sm font-medium text-primary">{member.name?.charAt(0).toUpperCase() ?? '?'}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="text-sm font-medium text-text truncate">{member.name}</p>
          {#if member.id === currentUserId}
            <span class="text-xs text-muted">(you)</span>
          {/if}
        </div>
        <p class="text-xs text-muted truncate">{member.email}</p>
      </div>
    </a>
    <div class="flex items-center gap-2 flex-shrink-0">
      <span class="text-xs px-2 py-0.5 rounded-full border capitalize {roleColors[member.role] ?? 'bg-slate-100 text-slate-500 border-slate-200'}">
        {member.role}
      </span>
      {#if member.id !== currentUserId && member.role !== 'admin'}
        {#if confirmDeleteId === member.id}
          <form method="POST" action="?/deleteTechnician" use:enhance={() => {
            return async ({ update }) => { await update(); confirmDeleteId = null }
          }} class="flex items-center gap-1">
            <input type="hidden" name="userId" value={member.id} />
            <span class="text-xs text-muted">Sure?</span>
            <button type="submit" class="text-xs px-2 py-1 bg-danger text-white rounded-lg">Yes</button>
            <button type="button" onclick={() => confirmDeleteId = null}
              class="text-xs px-2 py-1 border border-border rounded-lg hover:bg-surface">No</button>
          </form>
        {:else}
          <button onclick={() => confirmDeleteId = member.id}
            class="p-1.5 text-muted hover:text-danger border border-border rounded-lg hover:bg-red-50 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        {/if}
      {/if}
    </div>
  </div>
{/each}
    </div>
  {/if}
</div>