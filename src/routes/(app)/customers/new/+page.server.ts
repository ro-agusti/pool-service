import { redirect, fail } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async () => ({})

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const form = await request.formData()
    const name  = form.get('name') as string
    const email = form.get('email') as string | null
    const phone = form.get('phone') as string | null
    const notes = form.get('notes') as string | null

    if (!name?.trim()) return fail(400, { error: 'Name is required', name, email, phone, notes })

    const { data: userData } = await locals.supabase
      .from('users')
      .select('org_id')
      .eq('id', locals.user!.id)
      .single()

    if (!userData?.org_id) return fail(400, { error: 'Could not resolve organization', name, email, phone, notes })

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: customer, error } = await admin
      .from('customers')
      .insert({ org_id: userData.org_id, name, email, phone, notes })
      .select('id')
      .single()

    if (error) return fail(400, { error: error.message, name, email, phone, notes })

    throw redirect(303, `/customers/${customer.id}`)
  }
}