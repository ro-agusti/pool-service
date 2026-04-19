import type { PageServerLoad, Actions } from './$types'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user?.role !== 'admin') throw redirect(303, '/customers')

  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const org_id = locals.user!.org_id

  // All properties with active service plan and technician
  const { data: properties } = await admin
    .from('properties')
    .select(`
      id, address, suburb, lat, lng,
      customers ( id, name ),
      service_plans (
        id, technician_id, recurrence, active,
        preferred_day_of_week, preferred_time, start_date
      )
    `)
    .eq('org_id', org_id)
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  // Get all technicians
  const { data: technicians } = await admin
    .from('users')
    .select('id, name')
    .eq('org_id', org_id)
    .order('name')

  // Attach active plan and technician name to each property
  const technicianMap = Object.fromEntries((technicians ?? []).map((t: any) => [t.id, t.name]))

  const propertiesWithPlan = (properties ?? []).map((p: any) => {
    const activePlan = (p.service_plans ?? []).find((sp: any) => sp.active) ?? null
    return {
      ...p,
      active_plan: activePlan,
      technician_id: activePlan?.technician_id ?? null,
      technician_name: activePlan ? (technicianMap[activePlan.technician_id] ?? 'Unassigned') : null,
      service_plans: undefined
    }
  })

  return {
    properties: propertiesWithPlan,
    technicians: technicians ?? [],
    googleMapsKey: PUBLIC_GOOGLE_MAPS_KEY
  }
}

export const actions: Actions = {
  reassignTechnician: async ({ request, locals }) => {
    const form = await request.formData()
    const planId = form.get('planId') as string
    const technicianId = form.get('technicianId') as string
    const propertyId = form.get('propertyId') as string

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get current plan details
    const { data: plan } = await admin
      .from('service_plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (!plan) return

    // Update technician on plan
    await admin
      .from('service_plans')
      .update({ technician_id: technicianId })
      .eq('id', planId)

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

    // Delete future pending visits for this plan
    await admin
      .from('visits')
      .delete()
      .eq('service_plan_id', planId)
      .eq('status', 'pending')
      .gte('scheduled_date', todayStr)

    // Regenerate visits with new technician
    const generateFrom = plan.start_date > todayStr ? plan.start_date : todayStr

    await generateVisits(
      planId, propertyId, locals.user!.org_id,
      technicianId, plan.recurrence, plan.preferred_day_of_week,
      plan.preferred_time, generateFrom, admin
    )
  }
}

// ─── Helpers ───────────────────────────────────────────────

function dowOf(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  const yr = m < 3 ? y - 1 : y
  const dow = (yr + Math.floor(yr/4) - Math.floor(yr/100) + Math.floor(yr/400) + t[m-1] + d) % 7
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

function compareDate(ay: number, am: number, ad: number, by: number, bm: number, bd: number): number {
  if (ay !== by) return ay - by
  if (am !== bm) return am - bm
  return ad - bd
}

async function generateVisits(
  planId: string, propertyId: string, orgId: string,
  technicianId: string, recurrence: string, targetDow: number,
  time: string, startDate: string, admin: any
) {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const [ly, lm, ld] = addDays(ty, tm, td, 42)

  const [sy, sm, sd] = startDate.split('-').map(Number)
  let [cy, cm, cd] = compareDate(sy, sm, sd, ty, tm, td) >= 0
    ? [sy, sm, sd]
    : [ty, tm, td]

  const offset = (targetDow - dowOf(cy, cm, cd) + 7) % 7
  if (offset > 0) [cy, cm, cd] = addDays(cy, cm, cd, offset)

  if (compareDate(cy, cm, cd, ly, lm, ld) > 0) return

  const intervalDays = recurrence === 'weekly' ? 7 : recurrence === 'fortnightly' ? 14 : 28
  const visits: any[] = []

  while (compareDate(cy, cm, cd, ly, lm, ld) <= 0) {
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