// src/lib/utils/xero.ts
// Helper utilities for Xero API calls.
// All functions accept a Supabase admin client + org_id and handle token refresh transparently.

import { XERO_CLIENT_ID, XERO_CLIENT_SECRET } from '$env/static/private'
import type { SupabaseClient } from '@supabase/supabase-js'

interface Integration {
  tenant_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
}

// ── Token management ─────────────────────────────────────────────────────────

async function refreshAccessToken(
  admin: SupabaseClient,
  orgId: string,
  integration: Integration
): Promise<string> {
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token
    })
  })

  if (!res.ok) throw new Error(`Xero token refresh failed: ${await res.text()}`)

  const tokens = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await admin
    .from('integrations')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt
    })
    .eq('org_id', orgId)
    .eq('provider', 'xero')

  return tokens.access_token
}

/** Returns a valid access token, refreshing if needed. */
export async function getXeroToken(
  admin: SupabaseClient,
  orgId: string
): Promise<{ token: string; tenantId: string } | null> {
  const { data } = await admin
    .from('integrations')
    .select('tenant_id, access_token, refresh_token, token_expires_at')
    .eq('org_id', orgId)
    .eq('provider', 'xero')
    .maybeSingle()

  if (!data) return null

  const expiresAt = new Date(data.token_expires_at).getTime()
  const nowPlus60 = Date.now() + 60_000  // refresh if expires in < 60s

  const token = expiresAt < nowPlus60
    ? await refreshAccessToken(admin, orgId, data)
    : data.access_token

  return { token, tenantId: data.tenant_id }
}

// ── Xero API fetch helper ────────────────────────────────────────────────────

export async function xeroFetch(
  path: string,
  token: string,
  tenantId: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`https://api.xero.com/api.xro/2.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Xero-tenant-id': tenantId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers ?? {})
    }
  })
}

// ── Contact sync ─────────────────────────────────────────────────────────────

interface ClearWaveCustomer {
  id: string
  name: string
  email: string | null
  phone: string | null
  xero_contact_id: string | null
}

export async function syncCustomerToXero(
  admin: SupabaseClient,
  orgId: string,
  customer: ClearWaveCustomer
): Promise<string> {
  const auth = await getXeroToken(admin, orgId)
  if (!auth) throw new Error('Xero not connected')

  const body = {
    Name: customer.name,
    EmailAddress: customer.email ?? undefined,
    Phones: customer.phone
      ? [{ PhoneType: 'MOBILE', PhoneNumber: customer.phone }]
      : undefined
  }

  let res: Response

  if (customer.xero_contact_id) {
    // Update existing contact
    res = await xeroFetch(
      `/Contacts/${customer.xero_contact_id}`,
      auth.token,
      auth.tenantId,
      { method: 'POST', body: JSON.stringify({ Contacts: [{ ContactID: customer.xero_contact_id, ...body }] }) }
    )
  } else {
    // Create new contact
    res = await xeroFetch('/Contacts', auth.token, auth.tenantId, {
      method: 'PUT',
      body: JSON.stringify({ Contacts: [body] })
    })
  }

  if (!res.ok) throw new Error(`Xero contact sync failed: ${await res.text()}`)

  const data = await res.json()
  const xeroContactId: string = data.Contacts[0].ContactID

  // Save xero_contact_id back to ClearWave
  if (!customer.xero_contact_id) {
    await admin
      .from('customers')
      .update({ xero_contact_id: xeroContactId })
      .eq('id', customer.id)
  }

  return xeroContactId
}

// ── Invoice sync ─────────────────────────────────────────────────────────────

interface InvoiceLine {
  description: string
  qty: number
  unit_price: number
}

interface SyncInvoiceParams {
  invoiceId: string
  invoiceNumber: number
  xeroInvoiceId: string | null
  xeroContactId: string
  lines: InvoiceLine[]
  dueDate: string   // YYYY-MM-DD
  isPaid: boolean
}

export async function syncInvoiceToXero(
  admin: SupabaseClient,
  orgId: string,
  params: SyncInvoiceParams
): Promise<string> {
  const auth = await getXeroToken(admin, orgId)
  if (!auth) throw new Error('Xero not connected')

  const xeroInvoice = {
    Type: 'ACCREC',
    InvoiceNumber: `CW-${params.invoiceNumber}`,
    Contact: { ContactID: params.xeroContactId },
    DueDate: params.dueDate,
    Status: params.isPaid ? 'AUTHORISED' : 'DRAFT',
    LineItems: params.lines.map(l => ({
      Description: l.description,
      Quantity: l.qty,
      UnitAmount: l.unit_price,
      AccountCode: '200'   // default revenue account — make configurable later
    }))
  }

  let res: Response

  if (params.xeroInvoiceId) {
    res = await xeroFetch(`/Invoices/${params.xeroInvoiceId}`, auth.token, auth.tenantId, {
      method: 'POST',
      body: JSON.stringify({ Invoices: [{ InvoiceID: params.xeroInvoiceId, ...xeroInvoice }] })
    })
  } else {
    res = await xeroFetch('/Invoices', auth.token, auth.tenantId, {
      method: 'PUT',
      body: JSON.stringify({ Invoices: [xeroInvoice] })
    })
  }

  if (!res.ok) throw new Error(`Xero invoice sync failed: ${await res.text()}`)

  const data = await res.json()
  const xeroInvoiceId: string = data.Invoices[0].InvoiceID

  // Save xero_invoice_id back to ClearWave
  await admin
    .from('invoices')
    .update({ xero_invoice_id: xeroInvoiceId, xero_synced_at: new Date().toISOString() })
    .eq('id', params.invoiceId)

  return xeroInvoiceId
}