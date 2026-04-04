import { error, redirect } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const { data: customer } = await locals.supabase
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!customer) throw error(404, 'Customer not found')

  const { data: properties } = await locals.supabase
    .from('properties')
    .select('id, address, suburb, state, postcode, pool_type, pool_volume_litres')
    .eq('customer_id', params.id)
    .order('address')

  return { customer, properties: properties ?? [] }
}

export const actions: Actions = {
  deleteProperty: async ({ request }) => {
    const form = await request.formData()
    const propertyId = form.get('propertyId') as string
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin.from('properties').delete().eq('id', propertyId)
  },

  deleteCustomer: async ({ params }) => {
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin.from('customers').delete().eq('id', params.id)
    throw redirect(303, '/customers')
  }
}