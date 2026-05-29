// src/routes/(app)/settings/integrations/+page.server.ts
import { fail, redirect } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user?.role !== 'admin') throw redirect(303, '/visits')

  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: integration } = await admin
    .from('integrations')
    .select('tenant_name, connected_at, token_expires_at')
    .eq('org_id', locals.user.org_id)
    .eq('provider', 'xero')
    .maybeSingle()

  return {
    integration,
    success: url.searchParams.get('success'),
    error: url.searchParams.get('error')
  }
}

export const actions: Actions = {
  disconnectXero: async ({ locals }) => {
    if (locals.user?.role !== 'admin') return fail(403, { error: 'Forbidden' })

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { error } = await admin
      .from('integrations')
      .delete()
      .eq('org_id', locals.user!.org_id)
      .eq('provider', 'xero')

    if (error) return fail(500, { error: 'Could not disconnect Xero' })
    return { disconnected: true }
  }
}