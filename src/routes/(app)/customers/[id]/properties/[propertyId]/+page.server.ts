import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const { data: property } = await locals.supabase
    .from('properties')
    .select('*, customers(id, name)')
    .eq('id', params.propertyId)
    .single()

  if (!property) throw error(404, 'Property not found')

  const { data: plans } = await locals.supabase
    .from('service_plans')
    .select('*')
    .eq('property_id', params.propertyId)
    .order('created_at')

  // Próxima visita pendiente
  const { data: nextVisit } = await locals.supabase
    .from('visits')
    .select('id, scheduled_date, scheduled_time, status')
    .eq('property_id', params.propertyId)
    .eq('status', 'pending')
    .gte('scheduled_date', new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }))
    .order('scheduled_date')
    .limit(1)
    .maybeSingle()

  // Historial de visitas — incluye invoice status
  const { data: visitHistory } = await locals.supabase
    .from('visits')
    .select('id, scheduled_date, scheduled_time, status, skip_reason, type, invoices(status)')
    .eq('property_id', params.propertyId)
    .order('scheduled_date', { ascending: false })
    .limit(20)

  // Ver cuáles visitas tienen checklist
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
    plans: plans ?? [],
    nextVisit: nextVisit ?? null,
    visitHistory: (visitHistory ?? []).map((v: any) => ({
      ...v,
      hasChecklist: checklistIds.has(v.id),
      invoiceStatus: v.invoices?.[0]?.status ?? null
    }))
  }
}