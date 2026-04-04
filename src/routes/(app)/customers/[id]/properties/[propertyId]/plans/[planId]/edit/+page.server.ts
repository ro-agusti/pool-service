import { redirect, fail, error } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const { data: plan } = await locals.supabase
    .from('service_plans')
    .select('*')
    .eq('id', params.planId)
    .single()

  if (!plan) throw error(404, 'Plan not found')

  const { data: property } = await locals.supabase
    .from('properties')
    .select('id, address, org_id, customers(id, name)')
    .eq('id', params.propertyId)
    .single()

  return { plan, property, customer: property?.customers }
}

export const actions: Actions = {
  update: async ({ request, params }) => {
    const form = await request.formData()
    const recurrence            = form.get('recurrence') as string
    const preferred_day_of_week = Number(form.get('preferred_day_of_week'))
    const preferred_time        = form.get('preferred_time') as string
    const active                = form.get('active') === 'true'
    const notes                 = form.get('notes') as string | null
    const pool_equipment = {
      pump:        form.get('pump') as string || null,
      filter:      form.get('filter') as string || null,
      chlorinator: form.get('chlorinator') as string || null,
    }

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Actualizar el plan
    const { error: err } = await admin
      .from('service_plans')
      .update({ recurrence, preferred_day_of_week, preferred_time, active, notes, pool_equipment })
      .eq('id', params.planId)

    if (err) return fail(400, { error: err.message })

    // 2. Borrar visitas futuras pendientes
    const today = new Date().toISOString().split('T')[0]
    await admin
      .from('visits')
      .delete()
      .eq('service_plan_id', params.planId)
      .eq('status', 'pending')
      .gte('scheduled_date', today)

    // 3. Regenerar si sigue activo
    if (active) {
      const { data: property } = await admin
        .from('properties')
        .select('org_id')
        .eq('id', params.propertyId)
        .single()

      const { data: currentPlan } = await admin
        .from('service_plans')
        .select('technician_id, start_date')
        .eq('id', params.planId)
        .single()

      // Usar start_date si es futura, sino usar today
      const generateFrom = currentPlan?.start_date > today ? currentPlan.start_date : today

      await generateVisits(
        params.planId, params.propertyId, property?.org_id,
        currentPlan?.technician_id, recurrence, preferred_day_of_week,
        preferred_time, generateFrom, admin
      )
    }

    throw redirect(303, `/customers/${params.id}/properties/${params.propertyId}`)
  },

  delete: async ({ params }) => {
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const today = new Date().toISOString().split('T')[0]
    await admin
      .from('visits')
      .delete()
      .eq('service_plan_id', params.planId)
      .eq('status', 'pending')
      .gte('scheduled_date', today)

    await admin.from('service_plans').delete().eq('id', params.planId)

    throw redirect(303, `/customers/${params.id}/properties/${params.propertyId}`)
  }
}

function generateVisits(
  planId: string, propertyId: string, orgId: string,
  technicianId: string, recurrence: string, targetDow: number,
  time: string, startDate: string, admin: any
) {
  const [sy, sm, sd] = startDate.split('-').map(Number)

  function dowOf(y: number, m: number, d: number): number {
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
    if (m < 3) y--
    const dow = (y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) + t[m-1] + d) % 7
    return (dow + 6) % 7
  }

  function addDays(y: number, m: number, d: number, days: number): [number, number, number] {
    const months = [0,31,28,31,30,31,30,31,31,30,31,30,31]
    const isLeap = (yr: number) => yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)
    d += days
    while (true) {
      const dim = months[m] + (m === 2 && isLeap(y) ? 1 : 0)
      if (d <= dim) break
      d -= dim; m++
      if (m > 12) { m = 1; y++ }
    }
    return [y, m, d]
  }

  function toStr(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  const startDow = dowOf(sy, sm, sd)
  const offset = (targetDow - startDow + 7) % 7
  let [cy, cm, cd] = addDays(sy, sm, sd, offset)

  const now = new Date()
  const [ey, em, ed] = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
  const [ly, lm, ld] = addDays(ey, em, ed, 42)

  const intervalDays = recurrence === 'weekly' ? 7 : recurrence === 'fortnightly' ? 14 : 28
  const visits: any[] = []

  while (
    cy < ly || (cy === ly && cm < lm) || (cy === ly && cm === lm && cd <= ld)
  ) {
    visits.push({
      org_id: orgId,
      property_id: propertyId,
      service_plan_id: planId,
      technician_id: technicianId,
      type: 'recurring',
      scheduled_date: toStr(cy, cm, cd),
      scheduled_time: time,
      status: 'pending'
    })
    ;[cy, cm, cd] = addDays(cy, cm, cd, intervalDays)
  }

  if (visits.length > 0) {
    return admin.from('visits').insert(visits)
  }
}