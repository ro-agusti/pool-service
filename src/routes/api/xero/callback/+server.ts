// src/routes/api/xero/callback/+server.ts
import { redirect, error } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI } from '$env/static/private'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user || locals.user.role !== 'admin') {
    throw redirect(303, '/settings')
  }

  const code     = url.searchParams.get('code')
  const state    = url.searchParams.get('state')
  const errParam = url.searchParams.get('error')

  if (errParam) {
    throw redirect(303, '/settings/integrations?error=xero_denied')
  }

  if (!code || state !== locals.user.org_id) {
    throw error(400, 'Invalid OAuth state')
  }

  // 1. Exchange code for tokens
  const tokenRes = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: XERO_REDIRECT_URI
    })
  })

  if (!tokenRes.ok) {
    console.error('Xero token exchange failed:', await tokenRes.text())
    throw redirect(303, '/settings/integrations?error=xero_token')
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // 2. Fetch Xero tenants
  const tenantsRes = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  })

  if (!tenantsRes.ok) {
    throw redirect(303, '/settings/integrations?error=xero_tenants')
  }

  const tenants = await tenantsRes.json() as Array<{
    tenantId: string
    tenantName: string
  }>

  if (!tenants.length) {
    throw redirect(303, '/settings/integrations?error=xero_no_tenants')
  }

  const tenant = tenants[0]

  // 3. Save to integrations table
  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { error: dbError } = await admin
    .from('integrations')
    .upsert({
      org_id: locals.user.org_id,
      provider: 'xero',
      tenant_id: tenant.tenantId,
      tenant_name: tenant.tenantName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      connected_at: new Date().toISOString()
    }, { onConflict: 'org_id,provider' })

  if (dbError) {
    console.error('Supabase upsert error:', dbError)
    throw redirect(303, '/settings/integrations?error=xero_db')
  }

  throw redirect(303, '/settings/integrations?success=xero_connected')
}