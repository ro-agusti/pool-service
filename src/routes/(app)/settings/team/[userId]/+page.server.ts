// src/routes/(app)/settings/team/[userId]/+page.server.ts
import { error, redirect } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_GOOGLE_MAPS_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  if (locals.user?.role !== 'admin') throw redirect(303, '/settings')

  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

  const { data: member } = await admin
    .from('users')
    .select('id, name, email, role, phone, active, address, working_days, away_from, away_to')
    .eq('id', params.userId)
    .eq('org_id', locals.user!.org_id)
    .single()

  if (!member) throw error(404, 'Team member not found')

  // Compute status
  let status: 'active' | 'away' | 'deactivated' = 'active'
  if (member.active === false) {
    status = 'deactivated'
  } else if (member.away_from && member.away_to && today <= member.away_to) {
    status = 'away'
  }

  const { data: plans } = await admin
    .from('service_plans')
    .select(`
      id, recurrence, preferred_day_of_week, active,
      properties (
        id, address, suburb,
        customers ( id, name )
      )
    `)
    .eq('technician_id', params.userId)
    .eq('active', true)

  const { count: pendingVisits } = await admin
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('technician_id', params.userId)
    .eq('status', 'pending')
    .gte('scheduled_date', today)

  return {
    member: { ...member, status },
    plans: plans ?? [],
    pendingVisits: pendingVisits ?? 0
  }
}

export const actions: Actions = {
 updateMember: async ({ request, params }) => {
  const form = await request.formData()
  const name        = form.get('name') as string
  const phone       = form.get('phone') as string | null
  const email       = form.get('email') as string
  const address     = form.get('address') as string | null
  const workingDays = form.getAll('working_days').map(Number)

  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Geocode address if provided
  let lat: number | null = null
  let lng: number | null = null
  if (address) {
    try {
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${PUBLIC_GOOGLE_MAPS_KEY}`
      )
      const geoData = await geoRes.json()
      if (geoData.results?.[0]?.geometry?.location) {
        lat = geoData.results[0].geometry.location.lat
        lng = geoData.results[0].geometry.location.lng
      }
    } catch (e) {
      console.error('Geocoding failed:', e)
    }
  }

  await admin.from('users').update({
    name, phone, email, address, lat, lng,
    working_days: workingDays.length > 0 ? workingDays : [1,2,3,4,5]
  }).eq('id', params.userId)

  if (email) {
    await admin.auth.admin.updateUserById(params.userId, { email })
  }
},

  markAway: async ({ request, params, locals }) => {
    const form = await request.formData()
    const fromDate = form.get('fromDate') as string
    const toDate   = form.get('toDate') as string

    const admin  = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const adminId = locals.user!.id

    // Save away period on user
    await admin.from('users')
      .update({ away_from: fromDate, away_to: toDate })
      .eq('id', params.userId)

    // Skip all pending visits in the range
    const { data: visitsToSkip } = await admin
      .from('visits')
      .select('id')
      .eq('technician_id', params.userId)
      .eq('status', 'pending')
      .gte('scheduled_date', fromDate)
      .lte('scheduled_date', toDate)

    if (visitsToSkip && visitsToSkip.length > 0) {
      const ids = visitsToSkip.map((v: any) => v.id)
      await admin.from('visits')
        .update({ status: 'skipped', skip_reason: 'Technician away' })
        .in('id', ids)
      await admin.from('visit_logs').insert(
        ids.map((id: string) => ({
          visit_id: id,
          org_id: locals.user!.org_id,
          changed_by: adminId,
          old_status: 'pending',
          new_status: 'skipped',
          reason: `Technician away ${fromDate} to ${toDate}`
        }))
      )
    }

    throw redirect(303, `/settings/team/${params.userId}`)
  },

  cancelAway: async ({ params, locals }) => {
    const admin  = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const adminId = locals.user!.id

    // Get away period before clearing it
    const { data: member } = await admin
      .from('users')
      .select('away_from, away_to')
      .eq('id', params.userId)
      .single()

    // Reactivate skipped visits in the away period
    if (member?.away_from && member?.away_to) {
      const { data: visitsToRestore } = await admin
        .from('visits')
        .select('id')
        .eq('technician_id', params.userId)
        .eq('status', 'skipped')
        .eq('skip_reason', 'Technician away')
        .gte('scheduled_date', member.away_from)
        .lte('scheduled_date', member.away_to)

      if (visitsToRestore && visitsToRestore.length > 0) {
        const ids = visitsToRestore.map((v: any) => v.id)
        await admin.from('visits')
          .update({ status: 'pending', skip_reason: null })
          .in('id', ids)
        await admin.from('visit_logs').insert(
          ids.map((id: string) => ({
            visit_id: id,
            org_id: locals.user!.org_id,
            changed_by: adminId,
            old_status: 'skipped',
            new_status: 'pending',
            reason: 'Away period cancelled'
          }))
        )
      }
    }

    // Clear away period
    await admin.from('users')
      .update({ away_from: null, away_to: null })
      .eq('id', params.userId)

    throw redirect(303, `/settings/team/${params.userId}`)
  },

  deactivate: async ({ params, locals }) => {
    const admin   = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const adminId = locals.user!.id
    const today   = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

    const { data: plans } = await admin
      .from('service_plans')
      .select('id, property_id, recurrence, preferred_day_of_week, preferred_time, start_date')
      .eq('technician_id', params.userId)
      .eq('active', true)

    if (plans && plans.length > 0) {
      await admin.from('service_plans')
        .update({ technician_id: adminId })
        .eq('technician_id', params.userId)
        .eq('active', true)

      for (const plan of plans) {
        await admin.from('visits')
          .delete()
          .eq('service_plan_id', plan.id)
          .eq('status', 'pending')
          .gte('scheduled_date', today)

        await generateVisits(
          plan.id, plan.property_id, locals.user!.org_id,
          adminId, plan.recurrence, plan.preferred_day_of_week,
          plan.preferred_time, today, admin
        )
      }
    }

    await admin.from('users').update({ active: false, away_from: null, away_to: null }).eq('id', params.userId)
    await admin.auth.admin.updateUserById(params.userId, { ban_duration: '876600h' })

    throw redirect(303, '/settings/team')
  },

  reactivate: async ({ params }) => {
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    await admin.from('users')
      .update({ active: true, away_from: null, away_to: null })
      .eq('id', params.userId)

    await admin.auth.admin.updateUserById(params.userId, { ban_duration: 'none' })

    throw redirect(303, `/settings/team/${params.userId}`)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  let [cy, cm, cd] = compareDate(sy, sm, sd, ty, tm, td) >= 0 ? [sy, sm, sd] : [ty, tm, td]
  const offset = (targetDow - dowOf(cy, cm, cd) + 7) % 7
  if (offset > 0) [cy, cm, cd] = addDays(cy, cm, cd, offset)
  if (compareDate(cy, cm, cd, ly, lm, ld) > 0) return
  const intervalDays = recurrence === 'weekly' ? 7 : recurrence === 'fortnightly' ? 14 : 28
  const visits: any[] = []
  while (compareDate(cy, cm, cd, ly, lm, ld) <= 0) {
    visits.push({
      org_id: orgId, property_id: propertyId, service_plan_id: planId,
      technician_id: technicianId, type: 'recurring',
      scheduled_date: toStr(cy, cm, cd), scheduled_time: time, status: 'pending'
    })
    ;[cy, cm, cd] = addDays(cy, cm, cd, intervalDays)
  }
  if (visits.length > 0) await admin.from('visits').insert(visits)
}