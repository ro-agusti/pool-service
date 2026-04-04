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
    .gte('scheduled_date', new Date().toISOString().split('T')[0])
    .order('scheduled_date')
    .limit(1)
    .single()

  return { property, customer: property.customers, plans: plans ?? [], nextVisit: nextVisit ?? null }
}