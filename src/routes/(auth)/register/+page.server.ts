import { redirect, fail } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(303, '/dashboard')
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const form = await request.formData()
    const email = form.get('email') as string
    const password = form.get('password') as string
    const name = form.get('name') as string

    // 1. Crear auth user
    const { data, error } = await locals.supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    })

    if (error) return fail(400, { error: error.message, email, name })
    if (!data.user) return fail(400, { error: 'Could not create user.', email, name })

    // 2. Crear org y user row con service role (bypass RLS)
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
      + '-' + Math.random().toString(36).slice(2, 8)

    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ name, email, slug })
      .select('id')
      .single()

    if (orgError) return fail(400, { error: orgError.message, email, name })

    const { error: userError } = await admin
      .from('users')
      .insert({ id: data.user.id, org_id: org.id, role: 'admin', name, email })

    if (userError) return fail(400, { error: userError.message, email, name })

    throw redirect(303, '/dashboard')
  }
}