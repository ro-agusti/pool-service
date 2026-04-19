import { error } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: property } = await locals.supabase
    .from('properties')
    .select('*, customers(id, name)')
    .eq('id', params.propertyId)
    .single()

  if (!property) throw error(404, 'Property not found')

  const { data: plansRaw } = await locals.supabase
    .from('service_plans')
    .select('*')
    .eq('property_id', params.propertyId)
    .order('created_at')

  // Get technician names for all plans
  const techIds = [...new Set((plansRaw ?? []).map((p: any) => p.technician_id).filter(Boolean))]
  let techMap: Record<string, string> = {}
  if (techIds.length > 0) {
    const { data: techs } = await admin.from('users').select('id, name').in('id', techIds as string[])
    techMap = Object.fromEntries((techs ?? []).map((t: any) => [t.id, t.name]))
  }

  const plans = (plansRaw ?? []).map((p: any) => ({
    ...p,
    technician_name: techMap[p.technician_id] ?? null
  }))

  // Next pending visit
  const { data: nextVisit } = await locals.supabase
    .from('visits')
    .select('id, scheduled_date, scheduled_time, status')
    .eq('property_id', params.propertyId)
    .eq('status', 'pending')
    .gte('scheduled_date', new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }))
    .order('scheduled_date')
    .limit(1)
    .maybeSingle()

  // Visit history
  const { data: visitHistory } = await locals.supabase
    .from('visits')
    .select('id, scheduled_date, scheduled_time, status, skip_reason, type, invoices(status)')
    .eq('property_id', params.propertyId)
    .order('scheduled_date', { ascending: false })
    .limit(20)

  const visitIds = (visitHistory ?? []).map((v: any) => v.id)
  let checklistIds = new Set<string>()
  if (visitIds.length > 0) {
    const { data: checklists } = await locals.supabase
      .from('visit_checklists')
      .select('visit_id')
      .in('visit_id', visitIds)
    checklistIds = new Set((checklists ?? []).map((c: any) => c.visit_id))
  }

  return {
    property,
    customer: property.customers,
    plans,
    nextVisit: nextVisit ?? null,
    visitHistory: (visitHistory ?? []).map((v: any) => ({
      ...v,
      hasChecklist: checklistIds.has(v.id),
      invoiceStatus: v.invoices?.[0]?.status ?? null
    }))
  }
}