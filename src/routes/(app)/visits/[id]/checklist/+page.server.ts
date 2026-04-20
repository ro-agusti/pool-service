import { redirect, error } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ locals, params, url }) => {

const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const fromRoute = url.searchParams.get('from') === 'route'

  const { data: visit } = await admin
    .from('visits')
    .select('id, status, property_id, org_id, properties(id, address, suburb, pool_volume_litres, pool_type, customer_id, customers(name))')
    .eq('id', params.id)
    .single()

  if (!visit) throw error(404, 'Visit not found')

  const { data: checklist } = await admin
  .from('visit_checklists')
  .select('*')
  .eq('visit_id', params.id)
  .maybeSingle()

const { data: products } = await admin
  .from('products')
  .select('id, name, unit, unit_price, is_chemical')
  .eq('org_id', locals.user!.org_id)
  .eq('active', true)
  .order('sort_order')

const { data: historyRaw } = await admin
  .from('visits')
  .select(`id, scheduled_date, visit_checklists ( ph, chlorine, alkalinity, stabiliser, salt, calcium_hardness )`)
  .eq('property_id', visit.property_id)
  .eq('org_id', locals.user!.org_id)
  .eq('status', 'completed')
  .neq('id', params.id)
  .lt('scheduled_date', new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }))
  .order('scheduled_date', { ascending: false })
  .limit(3)

const visitHistory = (historyRaw ?? [])
  .map((v) => ({
    ...v,
    visit_checklists: v.visit_checklists ? [v.visit_checklists as any] : [],
  }))
  .filter((v) => v.visit_checklists.length > 0)
  .reverse() // chronological order for display
  const services  = (products ?? []).filter(p => !p.is_chemical)
  const chemicals = (products ?? []).filter(p => p.is_chemical)

return { visit, checklist: checklist ?? null, fromRoute, services, chemicals, visitHistory }
}

export const actions: Actions = {
  save: async ({ request, params, url }) => {
      const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const fromRoute = url.searchParams.get('from') === 'route'
    const form = await request.formData()

    const ph               = form.get('ph')               ? Number(form.get('ph'))               : null
    const chlorine         = form.get('chlorine')         ? Number(form.get('chlorine'))         : null
    const alkalinity       = form.get('alkalinity')       ? Number(form.get('alkalinity'))       : null
    const stabiliser       = form.get('stabiliser')       ? Number(form.get('stabiliser'))       : null
    const salt             = form.get('salt')             ? Number(form.get('salt'))             : null
    const calcium_hardness = form.get('calcium_hardness') ? Number(form.get('calcium_hardness')) : null
    const notes            = form.get('notes') as string | null
    const photosRaw        = form.get('photos') as string
    const photos           = photosRaw ? JSON.parse(photosRaw) : []
    const tasksRaw         = form.get('tasks_completed') as string
    const tasks_completed  = tasksRaw ? JSON.parse(tasksRaw) : []
    const chemicalsRaw     = form.get('chemicals_added') as string
    const chemicals_added  = chemicalsRaw ? JSON.parse(chemicalsRaw) : []



const { data: visit } = await admin
  .from('visits')
  .select('id, status, property_id, org_id, properties(id, address, suburb, pool_volume_litres, pool_type, customer_id, customers(name))')
  .eq('id', params.id)
  .single()

    await admin.from('visit_checklists').upsert({
      visit_id: params.id,
      org_id: visit?.org_id,
      ph, chlorine, alkalinity, stabiliser, salt, calcium_hardness,
      tasks_completed,
      chemicals_added,
      photos,
      notes,
      completed_at: new Date().toISOString()
    }, { onConflict: 'visit_id' })

    throw redirect(303, `/visits/${params.id}${fromRoute ? '?from=route' : ''}`)
  }
}