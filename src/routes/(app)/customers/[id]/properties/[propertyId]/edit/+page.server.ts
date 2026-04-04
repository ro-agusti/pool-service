import { redirect, fail, error } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const { data: property } = await locals.supabase
    .from('properties')
    .select('*')
    .eq('id', params.propertyId)
    .single()

  if (!property) throw error(404, 'Property not found')

  const { data: customer } = await locals.supabase
    .from('customers')
    .select('id, name')
    .eq('id', params.id)
    .single()

  return { property, customer }
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${PUBLIC_GOOGLE_MAPS_KEY}&region=au`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status === 'OK' && data.results[0]) {
    const { lat, lng } = data.results[0].geometry.location
    return { lat, lng }
  }
  return null
}

export const actions: Actions = {
  default: async ({ request, params }) => {
    const form = await request.formData()
    const address            = form.get('address') as string
    const suburb             = form.get('suburb') as string
    const state              = form.get('state') as string
    const postcode           = form.get('postcode') as string
    const pool_type          = form.get('pool_type') as string
    const pool_volume_litres = form.get('pool_volume_litres') ? Number(form.get('pool_volume_litres')) : null
    const notes              = form.get('notes') as string | null

    if (!address?.trim()) return fail(400, { error: 'Address is required', address, suburb, state, postcode, pool_type, notes })

    const fullAddress = `${address}, ${suburb} ${state} ${postcode}, Australia`
    const coords = await geocodeAddress(fullAddress)

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { error: err } = await admin
      .from('properties')
      .update({
        address, suburb, state, postcode,
        pool_type: pool_type || null,
        pool_volume_litres,
        notes,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null
      })
      .eq('id', params.propertyId)

    if (err) return fail(400, { error: err.message, address, suburb, state, postcode, pool_type, notes })

    throw redirect(303, `/customers/${params.id}/properties/${params.propertyId}`)
  }
}