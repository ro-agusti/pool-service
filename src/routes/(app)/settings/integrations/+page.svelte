<!-- src/routes/(app)/settings/integrations/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms'

  let { data, form } = $props<{
    data: {
      integration: { tenant_name: string; connected_at: string } | null
      success: string | null
      error: string | null
    }
    form: { disconnected?: boolean; error?: string } | null
  }>()

  const isConnected = $derived(!!data.integration && !form?.disconnected)

  const errorMessages: Record<string, string> = {
    xero_denied:     'You cancelled the Xero connection.',
    xero_token:      'Could not exchange auth code — try again.',
    xero_tenants:    'Could not fetch your Xero organisations.',
    xero_no_tenants: 'No Xero organisations found on your account.',
    xero_db:         'Connected to Xero but could not save — contact support.'
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }
</script>

<div class="max-w-2xl mx-auto px-4 py-8">
  <div class="mb-6">
    <a href="/settings" class="text-sm text-slate-500 hover:text-slate-700">← Settings</a>
    <h1 class="text-xl font-semibold text-slate-900 mt-2">Integrations</h1>
    <p class="text-sm text-slate-500 mt-1">Connect ClearWave to your other tools.</p>
  </div>

  <!-- Success / error banners -->
  {#if data.success === 'xero_connected'}
    <div class="mb-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
      <span>✓</span>
      <span>Xero connected successfully.</span>
    </div>
  {/if}
  {#if data.error}
    <div class="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      <span>⚠</span>
      <span>{errorMessages[data.error] ?? 'Something went wrong connecting to Xero.'}</span>
    </div>
  {/if}

  <!-- Xero card -->
  <div class="bg-white border border-slate-200 rounded-xl p-5">
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3">
        <!-- Xero logo placeholder (replace with actual SVG if desired) -->
        <div class="w-10 h-10 rounded-lg bg-[#13B5EA] flex items-center justify-center text-white font-bold text-sm">X</div>
        <div>
          <p class="font-medium text-slate-900">Xero</p>
          <p class="text-sm text-slate-500">Sync invoices and contacts to your Xero account.</p>
        </div>
      </div>

      {#if isConnected}
        <span class="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          Connected
        </span>
      {:else}
        <span class="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
          Not connected
        </span>
      {/if}
    </div>

    {#if isConnected && data.integration}
      <div class="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-sm text-slate-600">
        <p><span class="text-slate-400">Organisation:</span> {data.integration.tenant_name}</p>
        <p><span class="text-slate-400">Connected:</span> {formatDate(data.integration.connected_at)}</p>
      </div>
    {/if}

    <div class="mt-4 flex gap-3">
      {#if isConnected}
        <form method="POST" action="?/disconnectXero" use:enhance>
          <button
            type="submit"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            Disconnect
          </button>
        </form>
        <a
          href="/api/xero/connect"
          class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Reconnect
        </a>
      {:else}
        <a
          href="/api/xero/connect"
          class="rounded-lg bg-[#13B5EA] px-4 py-2 text-sm font-medium text-white hover:bg-[#0EA0D0] transition-colors"
        >
          Connect Xero
        </a>
      {/if}
    </div>
  </div>

  <!-- Future integrations placeholder -->
  <div class="mt-4 bg-white border border-dashed border-slate-200 rounded-xl p-5 text-center text-sm text-slate-400">
    More integrations coming soon — MYOB, Stripe, Mailchimp.
  </div>
</div>