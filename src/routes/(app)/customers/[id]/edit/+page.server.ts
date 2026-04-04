import { redirect, fail, error } from '@sveltejs/kit'
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

  return { customer }
}

export const actions: Actions = {
  default: async ({ request, params }) => {
    const form = await request.formData()
    const name  = form.get('name') as string
    const email = form.get('email') as string | null
    const phone = form.get('phone') as string | null
    const notes = form.get('notes') as string | null

    if (!name?.trim()) return fail(400, { error: 'Name is required', name, email, phone, notes })

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { error: err } = await admin
      .from('customers')
      .update({ name, email, phone, notes })
      .eq('id', params.id)

    if (err) return fail(400, { error: err.message, name, email, phone, notes })

    throw redirect(303, `/customers/${params.id}`)
  }
}