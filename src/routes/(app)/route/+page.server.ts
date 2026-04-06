import type { PageServerLoad, Actions } from './$types'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals, url }) => {
  const today = new Date().toISOString().split('T')[0]
  const selectedDate = url.searchParams.get('date') ?? today

  const { data: visitsRaw } = await locals.supabase
    .from('visits')
    .select(`
      id, status, scheduled_time, scheduled_date,
      properties (
        id, address, suburb, lat, lng,
        customers ( id, name, phone )
      )
    `)
    .eq('scheduled_date', selectedDate)
    .eq('technician_id', locals.user!.id)
    .order('scheduled_time')

  const visits = (visitsRaw ?? []).filter((v: any) => v.properties?.lat && v.properties?.lng)

  const { data: route } = await locals.supabase
    .from('routes')
    .select('id, status, optimized_at, date, origin_lat, origin_lng')
    .eq('date', selectedDate)
    .eq('technician_id', locals.user!.id)
    .maybeSingle()

  let routeVisits: any[] = []
  if (route) {
    const { data: rv } = await locals.supabase
      .from('route_visits')
      .select(`
        id, position, estimated_arrival, estimated_travel_mins, visit_id,
        visits (
          id, status, scheduled_time,
          properties (
            id, address, suburb, lat, lng,
            customers ( id, name, phone )
          )
        )
      `)
      .eq('route_id', route.id)
      .order('position')
    routeVisits = rv ?? []
  }

  return {
    visits,
    route: route ?? null,
    routeVisits,
    selectedDate,
    today,
    googleMapsKey: PUBLIC_GOOGLE_MAPS_KEY
  }
}

export const actions: Actions = {
  optimizeRoute: async ({ request, locals }) => {
    const form = await request.formData()
    const selectedDate = form.get('date') as string
    const visitIds = JSON.parse(form.get('visitIds') as string) as string[]
    const originLat = form.get('originLat') ? Number(form.get('originLat')) : null
    const originLng = form.get('originLng') ? Number(form.get('originLng')) : null

    console.log('optimizeRoute called, date:', selectedDate, 'visitIds:', visitIds.length, 'origin:', originLat, originLng)

    if (visitIds.length === 0) throw redirect(303, `/route?date=${selectedDate}`)

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: visits } = await admin
      .from('visits')
      .select('id, properties(address, suburb, lat, lng)')
      .in('id', visitIds)

    const validVisits = (visits ?? []).filter((v: any) => v.properties?.lat && v.properties?.lng)
    console.log('validVisits:', validVisits.length)

    if (validVisits.length < 2) {
      await saveRoute(admin, locals.user!, selectedDate, validVisits.map((v: any, i: number) => ({
        visit_id: v.id, position: i + 1, estimated_arrival: null, estimated_travel_mins: null
      })), originLat, originLng)
      throw redirect(303, `/route?date=${selectedDate}`)
    }

    try {
      const hasOrigin = originLat && originLng

      const apiOrigin = hasOrigin
        ? { latLng: { latitude: originLat, longitude: originLng } }
        : { latLng: { latitude: validVisits[0].properties.lat, longitude: validVisits[0].properties.lng } }

      const apiDestination = { latLng: { latitude: validVisits[validVisits.length - 1].properties.lat, longitude: validVisits[validVisits.length - 1].properties.lng } }

      // Intermediates: si hay origen del técnico, todas las visitas menos la última
      // Si no hay origen, las visitas entre la primera y la última
      const apiIntermediates = (hasOrigin ? validVisits.slice(0, -1) : validVisits.slice(1, -1)).map((v: any) => ({
        location: { latLng: { latitude: v.properties.lat, longitude: v.properties.lng } }
      }))

      const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': PUBLIC_GOOGLE_MAPS_KEY,
          'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.distanceMeters'
        },
        body: JSON.stringify({
          origin: { location: apiOrigin },
          destination: { location: apiDestination },
          intermediates: apiIntermediates.length ? apiIntermediates : undefined,
          travelMode: 'DRIVE',
          optimizeWaypointOrder: true
        })
      })

      const apiData = await res.json()
      console.log('Routes API status:', res.status)
      console.log('Routes API response:', JSON.stringify(apiData))

      const apiRoute = apiData.routes?.[0]
      const optimizedOrder: number[] = apiRoute?.optimizedIntermediateWaypointIndex ?? []
      const legs: any[] = apiRoute?.legs ?? []

      // Reconstruir orden completo — siempre incluye todas las visitas
      const intermediateVisits = hasOrigin ? validVisits.slice(0, -1) : validVisits.slice(1, -1)
      const reordered = [
        ...(hasOrigin ? [] : [validVisits[0]]),
        ...optimizedOrder.map((i: number) => intermediateVisits[i]),
        validVisits[validVisits.length - 1]
      ].filter(Boolean)

      console.log('reordered count:', reordered.length)
      console.log('legs count:', legs.length)

      const now = new Date()
      let currentMins = now.getHours() * 60 + now.getMinutes()

      const routeVisits = reordered.map((v: any, i: number) => {
        const durStr = legs[i]?.duration ?? '0s'
        const travelSecs = parseInt(durStr.replace('s', ''))
        const travelMins = Math.round(travelSecs / 60)
        currentMins += travelMins
        const h = Math.floor(currentMins / 60) % 24
        const m = currentMins % 60
        const arrival = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        return {
          visit_id: v.id,
          position: i + 1,
          estimated_arrival: arrival,
          estimated_travel_mins: travelMins
        }
      })

      console.log('routeVisits to save:', JSON.stringify(routeVisits))
      await saveRoute(admin, locals.user!, selectedDate, routeVisits, originLat, originLng)

    } catch (e) {
      console.error('Routes API error:', e)
      await saveRoute(admin, locals.user!, selectedDate, validVisits.map((v: any, i: number) => ({
        visit_id: v.id, position: i + 1, estimated_arrival: null, estimated_travel_mins: null
      })), originLat, originLng)
    }

    throw redirect(303, `/route?date=${selectedDate}`)
  }
}

async function saveRoute(admin: any, user: any, date: string, routeVisits: any[], originLat: number | null, originLng: number | null) {
  const { data: existing } = await admin
    .from('routes')
    .select('id')
    .eq('date', date)
    .eq('technician_id', user.id)
    .maybeSingle()

  if (existing) {
    await admin.from('route_visits').delete().eq('route_id', existing.id)
    await admin.from('routes').delete().eq('id', existing.id)
  }

  const { data: route } = await admin
    .from('routes')
    .insert({
      org_id: user.org_id,
      technician_id: user.id,
      date,
      status: 'active',
      optimized_at: new Date().toISOString(),
      origin_lat: originLat,
      origin_lng: originLng
    })
    .select('id')
    .single()

  if (route && routeVisits.length > 0) {
    await admin.from('route_visits').insert(
      routeVisits.map(rv => ({ ...rv, route_id: route.id }))
    )
  }
}