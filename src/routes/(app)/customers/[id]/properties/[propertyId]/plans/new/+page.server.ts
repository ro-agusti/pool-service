import { redirect, fail } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const { data: property } = await locals.supabase
    .from('properties')
    .select('id, address, org_id, customers(id, name)')
    .eq('id', params.propertyId)
    .single()

  const { data: technicians } = await locals.supabase
    .from('users')
    .select('id, name')
    .eq('org_id', property?.org_id)

  return { property, customer: property?.customers, technicians: technicians ?? [] }
}

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    const form = await request.formData()
    const recurrence            = form.get('recurrence') as string
    const preferred_day_of_week = Number(form.get('preferred_day_of_week'))
    const preferred_time        = form.get('preferred_time') as string
    const start_date            = form.get('start_date') as string
    const technician_id         = form.get('technician_id') as string
    const notes                 = form.get('notes') as string | null
    const pool_equipment = {
      pump:        form.get('pump') as string || null,
      filter:      form.get('filter') as string || null,
      chlorinator: form.get('chlorinator') as string || null,
    }

    const { data: property } = await locals.supabase
      .from('properties')
      .select('org_id')
      .eq('id', params.propertyId)
      .single()

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: plan, error } = await admin
      .from('service_plans')
      .insert({
        org_id: property?.org_id,
        property_id: params.propertyId,
        technician_id,
        recurrence,
        preferred_day_of_week,
        preferred_time,
        start_date,
        notes,
        pool_equipment,
        active: true
      })
      .select('id')
      .single()

    if (error) return fail(400, { error: error.message })

    // Generar visitas para las próximas 6 semanas
    await generateVisits(
      plan.id, params.propertyId, property?.org_id,
      technician_id, recurrence, preferred_day_of_week,
      preferred_time, start_date, admin
    )

    throw redirect(303, `/customers/${params.id}/properties/${params.propertyId}`)
  }
}

async function generateVisits(
  planId: string, propertyId: string, orgId: string,
  technicianId: string, recurrence: string, targetDow: number,
  time: string, startDate: string, admin: any
) {
  // Parsear startDate como partes — sin Date(), sin timezone
  const [sy, sm, sd] = startDate.split('-').map(Number)

  // Calcular el día de la semana de startDate (0=Mon ... 6=Sun)
  // Usando la fórmula de Tomohiko Sakamoto, ajustada para Mon=0
  function dowOf(y: number, m: number, d: number): number {
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
    if (m < 3) y--
    const dow = (y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) + t[m-1] + d) % 7
    // dow: 0=Sun,1=Mon,...,6=Sat → convertir a Mon=0
    return (dow + 6) % 7
  }

  // Avanzar días sumando a las partes de la fecha
  function addDays(y: number, m: number, d: number, days: number): [number, number, number] {
    // Convertir a días totales, sumar, volver a fecha
    const months = [0,31,28,31,30,31,30,31,31,30,31,30,31]
    const isLeap = (yr: number) => yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)

    d += days
    while (true) {
      const dim = months[m] + (m === 2 && isLeap(y) ? 1 : 0)
      if (d <= dim) break
      d -= dim
      m++
      if (m > 12) { m = 1; y++ }
    }
    return [y, m, d]
  }

  function toStr(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  // Encontrar primer día que coincide con targetDow desde startDate
  const startDow = dowOf(sy, sm, sd)
  const offset = (targetDow - startDow + 7) % 7
  let [cy, cm, cd] = addDays(sy, sm, sd, offset)

  // Fecha límite: hoy + 42 días
  const now = new Date()
  const [ey, em, ed] = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
  const [ly, lm, ld] = addDays(ey, em, ed, 42)

  const intervalDays = recurrence === 'weekly' ? 7 : recurrence === 'fortnightly' ? 14 : 28
  const visits = []

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
    await admin.from('visits').insert(visits)
  }
}