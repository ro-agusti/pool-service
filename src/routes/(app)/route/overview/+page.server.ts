import type { PageServerLoad } from './$types'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user?.role !== 'admin') throw redirect(303, '/route')

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const selectedDate = url.searchParams.get('date') ?? today

  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // All visits for this date across all technicians
  const { data: visitsRaw } = await admin
    .from('visits')
    .select(`
      id, status, scheduled_time, technician_id,
      properties (
        id, address, suburb, lat, lng,
        customers ( id, name )
      )
    `)
    .eq('scheduled_date', selectedDate)
    .eq('org_id', locals.user!.org_id)
    .order('scheduled_time')

  const visits = (visitsRaw ?? []).filter((v: any) => v.properties?.lat && v.properties?.lng)

  // Get all technician names
  const technicianIds = [...new Set(visits.map((v: any) => v.technician_id).filter(Boolean))]
  let technicians: { id: string, name: string }[] = []
  if (technicianIds.length > 0) {
    const { data: techs } = await admin
      .from('users')
      .select('id, name')
      .in('id', technicianIds)
    technicians = techs ?? []
  }

  const technicianMap = Object.fromEntries(technicians.map(t => [t.id, t.name]))

  const visitsWithTech = visits.map((v: any) => ({
    ...v,
    technician_name: technicianMap[v.technician_id] ?? 'Unassigned'
  }))

  // Week strip
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
    while (cd < 1) {
      cm--
      if (cm < 1) { cm = 12; cy-- }
      cd += months[cm] + (cm === 2 && isLeap(cy) ? 1 : 0)
    }
    while (true) {
      const dim = months[cm] + (cm === 2 && isLeap(cy) ? 1 : 0)
      if (cd <= dim) break
      cd -= dim; cm++
      if (cm > 12) { cm = 1; cy++ }
    }
    return `${cy}-${String(cm).padStart(2,'0')}-${String(cd).padStart(2,'0')}`
  }

  const mondayStr = addDaysToStr(selectedDate, -dowOf(selectedDate))
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysToStr(mondayStr, i))

  const { data: weekVisits } = await admin
    .from('visits')
    .select('scheduled_date')
    .eq('org_id', locals.user!.org_id)
    .gte('scheduled_date', weekDays[0])
    .lte('scheduled_date', weekDays[6])

  const weekDates = weekDays.map(date => ({
    date,
    hasVisits: (weekVisits ?? []).some((v: any) => v.scheduled_date === date)
  }))

  return {
    visits: visitsWithTech,
    technicians,
    selectedDate,
    today,
    weekDates,
    googleMapsKey: PUBLIC_GOOGLE_MAPS_KEY
  }
}