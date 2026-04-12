import { fail } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const { data: team } = await locals.supabase
    .from('users')
    .select('id, name, email, role')
    .eq('org_id', locals.user!.org_id)
    .order('role')
    .order('name')

  return { team: team ?? [] }
}

export const actions: Actions = {
  createTechnician: async ({ request, locals }) => {
    const form = await request.formData()
    const name     = form.get('name') as string
    const email    = form.get('email') as string
    const password = form.get('password') as string

    if (!name || !email || !password) {
      return fail(400, { error: 'All fields are required' })
    }

    if (password.length < 6) {
      return fail(400, { error: 'Password must be at least 6 characters' })
    }

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Crear usuario en Supabase Auth
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true // no requiere confirmación de email
    })

    if (authError) return fail(400, { error: authError.message })

    // Crear perfil en tabla users
    const { error: profileError } = await admin.from('users').insert({
      id: authUser.user.id,
      org_id: locals.user!.org_id,
      name,
      email,
      role: 'technician'
    })

    if (profileError) {
      // Rollback — borrar el auth user si falla el perfil
      await admin.auth.admin.deleteUser(authUser.user.id)
      return fail(400, { error: profileError.message })
    }

    return { success: true }
  },

  deleteTechnician: async ({ request, locals }) => {
    const form = await request.formData()
    const userId = form.get('userId') as string

    // No permitir borrarse a sí mismo
    if (userId === locals.user!.id) {
      return fail(400, { error: "You can't delete yourself" })
    }

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin.auth.admin.deleteUser(userId)
    await admin.from('users').delete().eq('id', userId)

    return { success: true }
  }
}