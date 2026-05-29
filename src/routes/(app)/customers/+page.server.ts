// src/routes/(app)/customers/+page.server.ts
import { fail } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY, XERO_CLIENT_ID, XERO_CLIENT_SECRET } from '$env/static/private'
import type { PageServerLoad, Actions } from './$types'

// ── Xero token helper ─────────────────────────────────────────────────────────

async function getValidXeroToken(
  admin: any,
  orgId: string
): Promise<{ token: string; tenantId: string } | null> {
  const { data } = await admin
    .from('integrations')
    .select('tenant_id, access_token, refresh_token, token_expires_at')
    .eq('org_id', orgId)
    .eq('provider', 'xero')
    .maybeSingle()

  if (!data) return null

  const needsRefresh = new Date(data.token_expires_at).getTime() < Date.now() + 60_000
  if (!needsRefresh) return { token: data.access_token, tenantId: data.tenant_id }

  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token
    })
  })

  if (!res.ok) return null

  const tokens = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await admin
    .from('integrations')
    .update({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_expires_at: newExpiry })
    .eq('org_id', orgId)
    .eq('provider', 'xero')

  return { token: tokens.access_token, tenantId: data.tenant_id }
}

// ── Load ──────────────────────────────────────────────────────────────────────

export const load: PageServerLoad = async ({ locals, url }) => {
  const search = url.searchParams.get('search') ?? ''
  const isAdmin = locals.user?.role === 'admin'

  let customers: any[] = []

  if (isAdmin) {
    let query = locals.supabase
      .from('customers')
      .select('id, name, email, phone, created_at, xero_contact_id')
      .order('name')
    if (search) query = query.ilike('name', `%${search}%`)
    const { data } = await query
    customers = data ?? []
  } else {
    const { data: visits } = await locals.supabase
      .from('visits')
      .select('properties(customer_id)')
      .eq('technician_id', locals.user!.id)
    const customerIds = [...new Set(
      (visits ?? []).map((v: any) => v.properties?.customer_id).filter(Boolean)
    )]
    if (customerIds.length === 0) return { customers: [], search, newXeroContacts: [] }
    let query = locals.supabase
      .from('customers')
      .select('id, name, email, phone, created_at')
      .in('id', customerIds)
      .order('name')
    if (search) query = query.ilike('name', `%${search}%`)
    const { data } = await query
    customers = data ?? []
    return { customers, search, newXeroContacts: [] }
  }

  // ── Poll Xero for new contacts (admin only) ───────────────────────────────
  let newXeroContacts: Array<{ xeroId: string; name: string; email: string | null; phone: string | null }> = []

  try {
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const auth = await getValidXeroToken(admin, locals.user!.org_id)

    if (auth) {
      // Fetch Xero contacts that are customers
      const res = await fetch(
        'https://api.xero.com/api.xro/2.0/Contacts?where=IsCustomer%3D%3Dtrue&summaryOnly=false',
        {
          headers: {
            Authorization: `Bearer ${auth.token}`,
            'Xero-tenant-id': auth.tenantId,
            Accept: 'application/json'
          }
        }
      )

      if (res.ok) {
        const data = await res.json()
        const xeroContacts: any[] = data.Contacts ?? []

        // Get all xero_contact_ids already linked in ClearWave
        const linkedIds = new Set(customers.map((c: any) => c.xero_contact_id).filter(Boolean))

        // Find contacts in Xero not yet in ClearWave
        newXeroContacts = xeroContacts
          .filter((c: any) => !linkedIds.has(c.ContactID))
          .map((c: any) => ({
            xeroId: c.ContactID,
            name: c.Name,
            email: c.EmailAddress || null,
            phone: c.Phones?.find((p: any) => p.PhoneType === 'MOBILE')?.PhoneNumber || null
          }))
          .slice(0, 50) // cap at 50 to avoid huge lists
      }
    }
  } catch (e) {
    // Xero polling failed silently — don't break the page
    console.error('Xero contact poll failed:', e)
  }

  return { customers, search, newXeroContacts }
}

// ── Actions ───────────────────────────────────────────────────────────────────

export const actions: Actions = {
  importXeroContacts: async ({ locals, request }) => {
    if (locals.user?.role !== 'admin') return fail(403, { error: 'Forbidden' })

    const form = await request.formData()
    const selected = form.getAll('contactIds') as string[]
    const namesRaw = form.get('contactNames') as string
    const emailsRaw = form.get('contactEmails') as string
    const phonesRaw = form.get('contactPhones') as string

    if (!selected.length) return fail(400, { error: 'No contacts selected' })

    const names = JSON.parse(namesRaw) as Record<string, string>
    const emails = JSON.parse(emailsRaw) as Record<string, string | null>
    const phones = JSON.parse(phonesRaw) as Record<string, string | null>

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const rows = selected.map(xeroId => ({
      org_id: locals.user!.org_id,
      name: names[xeroId] ?? 'Unknown',
      email: emails[xeroId] ?? null,
      phone: phones[xeroId] ?? null,
      xero_contact_id: xeroId
    }))

    const { error } = await admin.from('customers').insert(rows)
    if (error) return fail(500, { error: 'Could not import contacts' })

    return { imported: selected.length }
  }
}