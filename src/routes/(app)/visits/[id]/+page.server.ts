import { error, redirect } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const fromRoute = url.searchParams.get('from') === 'route'
  const fromCustomer =
    url.searchParams.get('from') === 'customer'
      ? url.searchParams.get('propertyId')
      : null

  const { data: visit } = await locals.supabase
    .from('visits')
    .select(`
      *,
      service_plans ( recurrence, preferred_day_of_week, pool_equipment ),
      properties (
        id, address, suburb, state, postcode, notes,
        pool_type, pool_volume_litres,
        customers ( id, name, phone, email )
      )
    `)
    .eq('id', params.id)
    .single()

  if (!visit) throw error(404, 'Visit not found')

  // Full checklist for the current visit (not just id)
  const { data: checklist } = await locals.supabase
    .from('visit_checklists')
    .select('*')
    .eq('visit_id', params.id)
    .maybeSingle()

  // Products catalog to resolve task names from UUIDs
  const { data: products } = await locals.supabase
    .from('products')
    .select('id, name')
    .eq('org_id', locals.user!.org_id)
    .eq('active', true)

  // Last visit for the "last visit" banner (visits before this one, completed)
  const { data: lastVisit } = await locals.supabase
    .from('visits')
    .select('id, scheduled_date, scheduled_time')
    .eq('property_id', visit.property_id)
    .eq('status', 'completed')
    .lt('scheduled_date', visit.scheduled_date)
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Last 3 completed visits (excluding current) with their checklists for trend chart
  // Only fetch if the current visit is completed and has a checklist
  let visitHistory: Array<{
    id: string
    scheduled_date: string
    visit_checklists: Array<{
      ph: number | null
      chlorine: number | null
      alkalinity: number | null
      stabiliser: number | null
      salt: number | null
      calcium_hardness: number | null
    }>
  }> = []

  if (visit.status === 'completed' && checklist) {
    const { data: history } = await locals.supabase
      .from('visits')
      .select(`
        id,
        scheduled_date,
        visit_checklists ( ph, chlorine, alkalinity, stabiliser, salt, calcium_hardness )
      `)
      .eq('property_id', visit.property_id)
      .eq('status', 'completed')
      .neq('id', params.id)
      .order('scheduled_date', { ascending: false })
      .limit(3)

    // Supabase returns visit_checklists as object (1-to-1), not array — normalize it
visitHistory = (history ?? [])
  .map((v) => ({
    ...v,
    visit_checklists: v.visit_checklists ? [v.visit_checklists as any] : [],
  }))
  .filter((v) => v.visit_checklists.length > 0)
  }

  const { data: invoice } = await locals.supabase
    .from('invoices')
    .select('id, status')
    .eq('visit_id', params.id)
    .maybeSingle()

  // Build a name lookup map from products
  const productMap = Object.fromEntries((products ?? []).map(p => [p.id, p.name]))

  return {
    visit,
    checklist: checklist ?? null,
    lastVisit: lastVisit ?? null,
    visitHistory,
    productMap,
    user: locals.user,
    fromRoute,
    fromCustomer,
    hasChecklist: !!checklist,
    existingInvoice: invoice ?? null,
  }
}

export const actions: Actions = {
  complete: async ({ params, locals, url }) => {
    const fromRoute = url.searchParams.get('from') === 'route'
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin.from('visits').update({ status: 'completed' }).eq('id', params.id)
    await admin.from('visit_logs').insert({
      visit_id: params.id,
      org_id: locals.user!.org_id,
      changed_by: locals.user!.id,
      old_status: 'in_progress',
      new_status: 'completed',
    })
    throw redirect(303, fromRoute ? `/visits/${params.id}?from=route` : `/visits`)
  },

  skip: async ({ request, params, locals, url }) => {
    const fromRoute = url.searchParams.get('from') === 'route'
    const form = await request.formData()
    const skipReason = form.get('skipReason') as string
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin
      .from('visits')
      .update({ status: 'skipped', skip_reason: skipReason })
      .eq('id', params.id)
    await admin.from('visit_logs').insert({
      visit_id: params.id,
      org_id: locals.user!.org_id,
      changed_by: locals.user!.id,
      old_status: 'in_progress',
      new_status: 'skipped',
      reason: skipReason,
    })
    throw redirect(303, fromRoute ? `/route` : `/visits`)
  },
}