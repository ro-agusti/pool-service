<script lang="ts">
  import { enhance } from '$app/forms'
  import type { ActionData } from './$types'

  let { form }: { form: ActionData } = $props()
  let loading = $state(false)
  let showPassword = $state(false)
</script>

<div class="min-h-screen bg-surface flex items-center justify-center p-4">
  <div class="w-full max-w-sm">

    <!-- Logo -->
    <div class="text-center mb-8">
      <a href="./" class="inline-flex items-center gap-2 mb-2 ">
      
        <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span class="text-white text-sm font-bold">C</span>
        </div>
        <span class="text-xl font-semibold text-text">ClearWave</span>
      
        
      </a>
      <p class="text-muted text-sm">Sign in to your account</p>
    </div>

    <!-- Card -->
    <div class="bg-card border border-border rounded-xl p-6 shadow-sm">
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
            <label for="email" class="block text-sm font-medium text-text mb-1">Email</label>
            <input
              id="email" name="email" type="email" required
              value={form?.email ?? ''}
              class="w-full px-3 py-2 rounded-lg border border-border bg-white text-text text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label for="password" class="block text-sm font-medium text-text">Password</label>
              <a href="/forgot-password" class="text-xs text-primary hover:underline">Forgot password?</a>
            </div>
            <div class="relative">
              <input
                id="password" name="password" required
                type={showPassword ? 'text' : 'password'}
                class="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-white text-text text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onclick={() => showPassword = !showPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {#if showPassword}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {/if}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            class="w-full py-2 px-4 rounded-lg bg-primary text-white text-sm font-medium
                   hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>

    <p class="text-center text-sm text-muted mt-4">
      Don't have an account?
      <a href="/register" class="text-primary hover:underline font-medium">Sign up</a>
    </p>

  </div>
</div>