<script lang="ts">
  import { createClient } from '@supabase/supabase-js'
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

  let loading = $state(false)
  let success = $state(false)
  let error = $state('')
  let email = $state('')

  async function handleSubmit() {
    if (!email) { error = 'Email is required'; return }
    loading = true
    error = ''

    const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    loading = false
    if (err) {
      error = err.message
    } else {
      success = true
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
      <p class="text-muted text-sm">Reset your password</p>
    </div>

    <div class="bg-card border border-border rounded-xl p-6 shadow-sm">
      {#if success}
        <div class="text-center py-4">
          <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p class="text-sm font-medium text-text mb-1">Check your email</p>
          <p class="text-xs text-muted">We sent a password reset link. Check your inbox and follow the instructions.</p>
        </div>
      {:else}
        {#if error}
          <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        {/if}

        <div class="space-y-4">
          <div>
            <label for="email" class="block text-sm font-medium text-text mb-1">Email</label>
            <input id="email" type="email" bind:value={email} required
              class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="you@example.com" />
          </div>
          <button onclick={handleSubmit} disabled={loading}
            class="w-full py-2 px-4 rounded-lg bg-primary text-white text-sm font-medium
                   hover:bg-primary-dark transition-colors disabled:opacity-50">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </div>
      {/if}
    </div>

    <p class="text-center text-sm text-muted mt-4">
      <a href="/login" class="text-primary hover:underline">← Back to login</a>
    </p>

  </div>
</div>