import { error, redirect } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const fromCustomer = url.searchParams.get('from') === 'customer'
    ? url.searchParams.get('customerId')
    : null

  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: visit } = await admin
    .from('visits')
    .select(`
      id, scheduled_date, org_id,
      properties (
        id, address, suburb, state, postcode,
        customers ( id, name, email, phone )
      )
    `)
    .eq('id', params.id)
    .single()

  if (!visit) throw error(404, 'Visit not found')

  const { data: invoice } = await admin
  .from('invoices')
  .select('*')
  .eq('visit_id', params.id)
  .maybeSingle()

// Invoice con snapshot completo — usar datos congelados
if (invoice?.lines_snapshot && invoice?.org_snapshot) {
  const lines = invoice.lines_snapshot as any[]
  const total = lines.reduce((sum, l) => sum + l.total, 0)
  return { visit, orgSettings: invoice.org_snapshot, invoice, lines, total, fromCustomer }
}

// Invoice viejo (sin lines_snapshot) — calcular líneas en vivo pero usar org_snapshot si existe
const { data: checklist } = await admin
  .from('visit_checklists')
  .select('tasks_completed, chemicals_added')
  .eq('visit_id', params.id)
  .maybeSingle()

const { data: products } = await admin
  .from('products')
  .select('id, name, unit_price, unit, is_chemical')
  .eq('org_id', locals.user!.org_id)

// Usar org_snapshot si existe, sino buscar en vivo
const orgSettings = invoice?.org_snapshot ?? await admin
  .from('org_settings')
  .select('*')
  .eq('org_id', locals.user!.org_id)
  .maybeSingle()
  .then(r => r.data)

const productMap = new Map((products ?? []).map(p => [p.id, p]))

const serviceLines = (checklist?.tasks_completed ?? [])
  .map((id: string) => {
    const p = productMap.get(id)
    if (!p) return null
    return { name: p.name, qty: 1, unit: p.unit, unit_price: p.unit_price, total: p.unit_price }
  })
  .filter(Boolean)

const chemicalLines = (checklist?.chemicals_added ?? [])
  .filter((c: any) => c.amount > 0)
  .map((c: any) => ({
    name: c.name,
    qty: c.amount,
    unit: c.unit,
    unit_price: c.unit_price ?? 0,
    total: c.amount * (c.unit_price ?? 0)
  }))

const lines = [...serviceLines, ...chemicalLines]
const total = lines.reduce((sum, l) => sum + l!.total, 0)

return { visit, orgSettings, invoice: invoice ?? null, lines, total, fromCustomer }
}

export const actions: Actions = {
  create: async ({ params, locals, request }) => {
  const form = await request.formData()
  const fromCustomer = form.get('fromCustomer') as string | null
  const suffix = fromCustomer ? `?from=customer&customerId=${fromCustomer}` : ''
  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: existing } = await admin
    .from('invoices')
    .select('id')
    .eq('visit_id', params.id)
    .maybeSingle()
  if (existing) throw redirect(303, `/visits/${params.id}/invoice${suffix}`)

  // Snapshot org settings
  const { data: orgSettings } = await admin
    .from('org_settings')
    .select('*')
    .eq('org_id', locals.user!.org_id)
    .maybeSingle()

  // Snapshot visit + lines
  const { data: visit } = await admin
    .from('visits')
    .select(`id, scheduled_date, org_id, properties(id, address, suburb, state, postcode, customers(id, name, email, phone))`)
    .eq('id', params.id)
    .single()

  const { data: checklist } = await admin
    .from('visit_checklists')
    .select('tasks_completed, chemicals_added')
    .eq('visit_id', params.id)
    .maybeSingle()

  const { data: products } = await admin
    .from('products')
    .select('id, name, unit_price, unit')
    .eq('org_id', locals.user!.org_id)

  const productMap = new Map((products ?? []).map(p => [p.id, p]))

  const serviceLines = (checklist?.tasks_completed ?? [])
    .map((id: string) => {
      const p = productMap.get(id)
      if (!p) return null
      return { name: p.name, qty: 1, unit: p.unit, unit_price: p.unit_price, total: p.unit_price }
    })
    .filter(Boolean)

  const chemicalLines = (checklist?.chemicals_added ?? [])
    .filter((c: any) => c.amount > 0)
    .map((c: any) => ({
      name: c.name, qty: c.amount, unit: c.unit,
      unit_price: c.unit_price ?? 0,
      total: c.amount * (c.unit_price ?? 0)
    }))

  const lines = [...serviceLines, ...chemicalLines]

  const { count } = await admin
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', locals.user!.org_id)

  const invoice_number = 1000001 + (count ?? 0)

  await admin.from('invoices').insert({
    org_id: locals.user!.org_id,
    visit_id: params.id,
    status: 'pending',
    invoice_number,
    org_snapshot: orgSettings ?? null,
    lines_snapshot: lines,
  })

  throw redirect(303, `/visits/${params.id}/invoice${suffix}`)
},

  markPaid: async ({ params, request }) => {
  const form = await request.formData()
  const fromCustomer = form.get('fromCustomer') as string | null
  const suffix = fromCustomer ? `?from=customer&customerId=${fromCustomer}` : ''

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('visit_id', params.id)

  throw redirect(303, `/visits/${params.id}/invoice${suffix}`)
  }
}