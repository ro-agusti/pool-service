import type { PageServerLoad, Actions } from './$types'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals, url }) => {
  const dateParam = url.searchParams.get('date')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const selectedDate = dateParam ?? today

  function dowOf(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number)
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
    const yr = m < 3 ? y - 1 : y
    const dow = (yr + Math.floor(yr/4) - Math.floor(yr/100) + Math.floor(yr/400) + t[m-1] + d) % 7
    return (dow + 6) % 7
  }

  function addDaysToStr(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const months = [0,31,28,31,30,31,30,31,31,30,31,30,31]
    const isLeap = (yr: number) => yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)
    let cy = y, cm = m, cd = d + days
    while (cd < 1) { cm--; if (cm < 1) { cm = 12; cy-- } cd += months[cm] + (cm === 2 && isLeap(cy) ? 1 : 0) }
    while (true) { const dim = months[cm] + (cm === 2 && isLeap(cy) ? 1 : 0); if (cd <= dim) break; cd -= dim; cm++; if (cm > 12) { cm = 1; cy++ } }
    return `${cy}-${String(cm).padStart(2,'0')}-${String(cd).padStart(2,'0')}`
  }

  const isAdmin = locals.user!.role === 'admin'

// Week strip
const mondayStr = addDaysToStr(selectedDate, -dowOf(selectedDate))
const weekDays = Array.from({ length: 7 }, (_, i) => addDaysToStr(mondayStr, i))

const weekQuery = locals.supabase
  .from('visits')
  .select('scheduled_date')
  .gte('scheduled_date', weekDays[0])
  .lte('scheduled_date', weekDays[6])
const { data: weekVisits } = await (isAdmin ? weekQuery : weekQuery.eq('technician_id', locals.user!.id))

const datesWithVisits = new Set(weekVisits?.map((v: any) => v.scheduled_date) ?? [])
const weekDates = weekDays.map(date => ({ date, hasVisits: datesWithVisits.has(date) }))

// Month calendar dots
const [sy, sm] = selectedDate.split('-').map(Number)
const monthStart = `${sy}-${String(sm).padStart(2,'0')}-01`
const daysInMonth = [0,31,28,31,30,31,30,31,31,30,31,30,31]
const isLeap = (yr: number) => yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)
const dim = daysInMonth[sm] + (sm === 2 && isLeap(sy) ? 1 : 0)
const monthEnd = `${sy}-${String(sm).padStart(2,'0')}-${String(dim).padStart(2,'0')}`

const monthQuery = locals.supabase
  .from('visits')
  .select('scheduled_date, status')
  .gte('scheduled_date', monthStart)
  .lte('scheduled_date', monthEnd)
const { data: monthVisits } = await (isAdmin ? monthQuery : monthQuery.eq('technician_id', locals.user!.id))

// Agrupar por fecha: { date -> { total, completed } }
const monthMap: Record<string, { total: number; completed: number }> = {}
for (const v of monthVisits ?? []) {
  if (!monthMap[v.scheduled_date]) monthMap[v.scheduled_date] = { total: 0, completed: 0 }
  monthMap[v.scheduled_date].total++
  if (v.status === 'completed') monthMap[v.scheduled_date].completed++
}

// Visits del día seleccionado
const visitsQuery = locals.supabase
  .from('visits')
  .select(`
    id, status, scheduled_time, type, notes, skip_reason, technician_id,
    service_plans ( recurrence, preferred_day_of_week ),
    properties (
      id, address, suburb, state, postcode, lat, lng,
      customers ( id, name, phone )
    ),
    invoices ( status )
  `)
  .eq('scheduled_date', selectedDate)
  .order('scheduled_time')

const result = await (isAdmin ? visitsQuery : visitsQuery.eq('technician_id', locals.user!.id))
const visitsRaw = result.data ?? []

// Obtener nombres de técnicos con service role (bypasea RLS)
const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const technicianIds = [...new Set(visitsRaw.map((v: any) => v.technician_id).filter(Boolean))]
let technicianMap: Record<string, string> = {}
if (technicianIds.length > 0) {
  const { data: techs } = await admin
    .from('users')
    .select('id, name')
    .in('id', technicianIds)
  technicianMap = Object.fromEntries((techs ?? []).map((t: any) => [t.id, t.name]))
}

const visits = visitsRaw.map((v: any) => ({
  ...v,
  technician_name: technicianMap[v.technician_id] ?? null
}))

// Backlog
const backlogQuery = locals.supabase
  .from('visits')
  .select(`
    id, status, scheduled_date, scheduled_time, skip_reason,
    properties ( id, address, suburb, customers ( id, name ) )
  `)
  .in('status', ['pending', 'skipped'])
  .lt('scheduled_date', today)
  .order('scheduled_date')
const { data: backlog } = await (isAdmin ? backlogQuery : backlogQuery.eq('technician_id', locals.user!.id))

  return {
    visits: visits ?? [],
    backlog: backlog ?? [],
    selectedDate,
    today,
    weekDates,
    monthMap,
    monthYear: { year: sy, month: sm }
  }
}

export const actions: Actions = {
  startVisit: async ({ request, locals }) => {
    const form = await request.formData()
    const visitId   = form.get('visitId') as string
    const oldStatus = form.get('oldStatus') as string
    const fromRoute = form.get('fromRoute') === 'true'
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    await admin.from('visits').update({ status: 'in_progress' }).eq('id', visitId)
    await admin.from('visit_logs').insert({
      visit_id: visitId,
      org_id: locals.user!.org_id,
      changed_by: locals.user!.id,
      old_status: oldStatus,
      new_status: 'in_progress'
    })

    throw redirect(303, `/visits/${visitId}${fromRoute ? '?from=route' : ''}`)
  },

  skipVisit: async ({ request, locals }) => {
    const form = await request.formData()
    const visitId    = form.get('visitId') as string
    const oldStatus  = form.get('oldStatus') as string
    const skipReason = form.get('skipReason') as string
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    await admin.from('visits').update({ status: 'skipped', skip_reason: skipReason }).eq('id', visitId)
    await admin.from('visit_logs').insert({
      visit_id: visitId,
      org_id: locals.user!.org_id,
      changed_by: locals.user!.id,
      old_status: oldStatus,
      new_status: 'skipped',
      reason: skipReason
    })
  },

  cancelVisit: async ({ request, locals }) => {
    const form = await request.formData()
    const visitId = form.get('visitId') as string
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    await admin.from('visits').update({ status: 'cancelled' }).eq('id', visitId)
    await admin.from('visit_logs').insert({
      visit_id: visitId,
      org_id: locals.user!.org_id,
      changed_by: locals.user!.id,
      old_status: 'pending',
      new_status: 'cancelled'
    })
  }
}