<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { createClient } from '@supabase/supabase-js'
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

  let loading = $state(false)
  let showPassword = $state(false)
  let showConfirm = $state(false)
  let sessionReady = $state(false)
  let sessionError = $state('')
  let formError = $state('')
  let success = $state(false)

  let password = $state('')
  let confirm = $state('')

  let supabase: any

  onMount(async () => {
  supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
    if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
      sessionReady = true
    }
  })

  return () => subscription.unsubscribe()
})

  async function handleSubmit() {
  formError = ''

  if (password.length < 6) {
    formError = 'Password must be at least 6 characters'
    return
  }
  if (password !== confirm) {
    formError = 'Passwords do not match'
    return
  }

  loading = true
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    loading = false
    formError = error.message
  } else {
    // Cerrar sesión client-side para que el servidor arranque limpio
    await supabase.auth.signOut()
    success = true
    setTimeout(() => goto('/login'), 2000)
  }
}
</script>

<div class="min-h-screen bg-surface flex items-center justify-center p-4">
  <div class="w-full max-w-sm">

    <div class="text-center mb-8">
      <div class="inline-flex items-center gap-2 mb-2">
        <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span class="text-white text-sm font-bold">C</span>
        </div>
        <span class="text-xl font-semibold text-text">ClearWave</span>
      </div>
      <p class="text-muted text-sm">Choose a new password</p>
    </div>

    <div class="bg-card border border-border rounded-xl p-6 shadow-sm">
      {#if success}
        <div class="text-center py-4">
          <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p class="text-sm font-medium text-text mb-1">Password updated!</p>
          <p class="text-xs text-muted">Redirecting to login…</p>
        </div>

      {:else if sessionError}
        <div class="text-center py-4">
          <p class="text-sm text-danger mb-3">{sessionError}</p>
          <a href="/forgot-password"
            class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
            Request new link
          </a>
        </div>

      {:else if !sessionReady}
        <div class="flex flex-col items-center justify-center py-8 gap-3">
          <svg class="animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          <p class="text-xs text-muted">Verifying reset link…</p>
        </div>

      {:else}
        {#if formError}
          <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {formError}
          </div>
        {/if}

        <div class="space-y-4">
          <div>
            <label for="password" class="block text-sm font-medium text-text mb-1">New password</label>
            <div class="relative">
              <input id="password" bind:value={password} required
                type={showPassword ? 'text' : 'password'}
                class="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-white text-text text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Min. 6 characters" />
              <button type="button" onclick={() => showPassword = !showPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors">
                {#if showPassword}
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {/if}
              </button>
            </div>
          </div>

          <div>
            <label for="confirm" class="block text-sm font-medium text-text mb-1">Confirm password</label>
            <div class="relative">
              <input id="confirm" bind:value={confirm} required
                type={showConfirm ? 'text' : 'password'}
                class="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-white text-text text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Repeat your password" />
              <button type="button" onclick={() => showConfirm = !showConfirm}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors">
                {#if showConfirm}
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {/if}
              </button>
            </div>
          </div>

          <button onclick={handleSubmit} disabled={loading}
            class="w-full py-2 px-4 rounded-lg bg-primary text-white text-sm font-medium
                   hover:bg-primary-dark transition-colors disabled:opacity-50">
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </div>
      {/if}
    </div>

    <p class="text-center text-sm text-muted mt-4">
      <a href="/login" class="text-primary hover:underline">← Back to login</a>
    </p>

  </div>
</div>