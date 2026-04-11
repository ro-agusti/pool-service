import type { PageServerLoad, Actions } from './$types'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import { redirect } from '@sveltejs/kit'

function addDaysToStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const months = [0,31,28,31,30,31,30,31,31,30,31,30,31]
  const isLeap = (yr: number) => yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)
  let cy = y, cm = m, cd = d + days
  while (true) {
    const dim = months[cm] + (cm === 2 && isLeap(cy) ? 1 : 0)
    if (cd <= dim) break
    cd -= dim; cm++
    if (cm > 12) { cm = 1; cy++ }
  }
  return `${cy}-${String(cm).padStart(2,'0')}-${String(cd).padStart(2,'0')}`
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const selectedDate = url.searchParams.get('date') ?? today
  const radiusKm = 20

  // Visitas del día seleccionado (grises en el mapa)
  const { data: todayVisits } = await locals.supabase
    .from('visits')
    .select(`
      id, status, scheduled_time,
      properties ( id, address, suburb, lat, lng, customers ( name ) )
    `)
    .eq('scheduled_date', selectedDate)
    .eq('technician_id', locals.user!.id)
    .not('status', 'in', '("completed","cancelled")')
    .order('scheduled_time')

  const validTodayVisits = (todayVisits ?? []).filter((v: any) => v.properties?.lat && v.properties?.lng)

  // Centroide de las visitas del día
  let centerLat: number | null = null
  let centerLng: number | null = null

  if (validTodayVisits.length > 0) {
    centerLat = validTodayVisits.reduce((s: number, v: any) => s + v.properties.lat, 0) / validTodayVisits.length
    centerLng = validTodayVisits.reduce((s: number, v: any) => s + v.properties.lng, 0) / validTodayVisits.length
  }

  // Visitas de los próximos 3 días
  const futureDates = [1, 2, 3].map(i => addDaysToStr(selectedDate, i))

  const { data: futureVisits } = await locals.supabase
    .from('visits')
    .select(`
      id, scheduled_date, status,
      properties ( id, address, suburb, lat, lng, customers ( name ) )
    `)
    .in('scheduled_date', futureDates)
    .eq('technician_id', locals.user!.id)
    .eq('status', 'pending')

  // Filtrar por radio si hay centroide
  const nearbyVisits = (futureVisits ?? [])
    .filter((v: any) => v.properties?.lat && v.properties?.lng)
    .map((v: any) => {
      const dist = centerLat && centerLng
        ? Math.round(haversineKm(centerLat, centerLng, v.properties.lat, v.properties.lng) * 10) / 10
        : null
      return { ...v, distanceKm: dist }
    })
    .filter((v: any) => v.distanceKm === null || v.distanceKm <= radiusKm)
    .sort((a: any, b: any) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))

  return {
    selectedDate,
    today,
    todayVisits: validTodayVisits,
    nearbyVisits,
    centerLat,
    centerLng,
    googleMapsKey: PUBLIC_GOOGLE_MAPS_KEY
  }
}

export const actions: Actions = {
  moveToDay: async ({ request, locals }) => {
    const form = await request.formData()
    const visitId    = form.get('visitId') as string
    const toDate     = form.get('toDate') as string
    const fromDate   = form.get('fromDate') as string

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    await admin.from('visits').update({ scheduled_date: toDate }).eq('id', visitId)

    await admin.from('visit_logs').insert({
      visit_id: visitId,
      org_id: locals.user!.org_id,
      changed_by: locals.user!.id,
      old_date: fromDate,
      new_date: toDate,
      reason: 'Moved to route day via nearby visits'
    })

    throw redirect(303, `/route/nearby-visits?date=${toDate}`)
  }
}