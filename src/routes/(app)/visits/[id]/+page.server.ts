import { error } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
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

  // Última visita completada de esta propiedad en días anteriores
  const { data: lastVisit } = await locals.supabase
    .from('visits')
    .select('id, scheduled_date, scheduled_time')
    .eq('property_id', visit.property_id)
    .eq('status', 'completed')
    .lt('scheduled_date', visit.scheduled_date)
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .single()

  return { visit, lastVisit: lastVisit ?? null, user: locals.user }
}

export const actions: Actions = {
  complete: async ({ params, locals }) => {
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin.from('visits').update({ status: 'completed' }).eq('id', params.id)
    await admin.from('visit_logs').insert({
      visit_id: params.id,
      org_id: locals.user!.org_id,
      changed_by: locals.user!.id,
      old_status: 'in_progress',
      new_status: 'completed'
    })
    const { redirect } = await import('@sveltejs/kit')
    throw redirect(303, `/visits`)
  },

  skip: async ({ request, params, locals }) => {
    const form = await request.formData()
    const skipReason = form.get('skipReason') as string
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin.from('visits').update({ status: 'skipped', skip_reason: skipReason }).eq('id', params.id)
    await admin.from('visit_logs').insert({
      visit_id: params.id,
      org_id: locals.user!.org_id,
      changed_by: locals.user!.id,
      old_status: 'in_progress',
      new_status: 'skipped',
      reason: skipReason
    })
    const { redirect } = await import('@sveltejs/kit')
    throw redirect(303, `/visits`)
  }
}