import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const { data: visit } = await locals.supabase
    .from('visits')
    .select('id, scheduled_date, scheduled_time, properties(address, suburb, customers(name))')
    .eq('id', params.id)
    .single()

  if (!visit) throw error(404, 'Visit not found')

  const { data: checklist } = await locals.supabase
    .from('visit_checklists')
    .select('*')
    .eq('visit_id', params.id)
    .maybeSingle()

  const { data: products } = await locals.supabase
    .from('products')
    .select('id, name')
    .eq('org_id', locals.user!.org_id)
    .eq('active', true)

  const productMap = Object.fromEntries((products ?? []).map(p => [p.id, p.name]))

  return { visit, checklist: checklist ?? null, productMap }
}