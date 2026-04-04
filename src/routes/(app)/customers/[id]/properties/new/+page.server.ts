import { redirect, fail } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const { data: customer } = await locals.supabase
    .from('customers')
    .select('id, name, org_id')
    .eq('id', params.id)
    .single()

  return { customer }
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
  default: async ({ request, params, locals }) => {
    const form = await request.formData()
    const address  = form.get('address') as string
    const suburb   = form.get('suburb') as string
    const state    = form.get('state') as string
    const postcode = form.get('postcode') as string
    const pool_type = form.get('pool_type') as string
    const pool_volume_litres = form.get('pool_volume_litres') ? Number(form.get('pool_volume_litres')) : null
    const notes    = form.get('notes') as string | null

    if (!address?.trim()) return fail(400, { error: 'Address is required', address, suburb, state, postcode, pool_type, notes })

    // Geocode the full address
    const fullAddress = `${address}, ${suburb} ${state} ${postcode}, Australia`
    const coords = await geocodeAddress(fullAddress)

    // Get org_id from customer
    const { data: customer } = await locals.supabase
      .from('customers')
      .select('org_id')
      .eq('id', params.id)
      .single()

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: property, error } = await admin
      .from('properties')
      .insert({
        org_id: customer?.org_id,
        customer_id: params.id,
        address,
        suburb,
        state,
        postcode,
        pool_type: pool_type || null,
        pool_volume_litres,
        notes,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null
      })
      .select('id')
      .single()

    if (error) return fail(400, { error: error.message, address, suburb, state, postcode, pool_type, notes })

    throw redirect(303, `/customers/${params.id}`)
  }
}