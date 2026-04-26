import { fail } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: team } = await admin
    .from('users')
    .select('id, name, email, role, phone, address, working_days')
    .eq('org_id', locals.user!.org_id)
    .order('role')
    .order('name')
  return { team: team ?? [] }
}

export const actions: Actions = {
  createTechnician: async ({ request, locals }) => {
    const form = await request.formData()
    const name        = form.get('name') as string
    const email       = form.get('email') as string
    const password    = form.get('password') as string
    const phone       = form.get('phone') as string || null
    const address     = form.get('address') as string || null
    const workingDays = form.getAll('working_days').map(Number)

    if (!name || !email || !password)
      return fail(400, { error: 'Name, email and password are required' })
    if (password.length < 6)
      return fail(400, { error: 'Password must be at least 6 characters' })

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true
    })
    if (authError) return fail(400, { error: authError.message })

    const { error: profileError } = await admin.from('users').insert({
      id: authUser.user.id,
      org_id: locals.user!.org_id,
      name, email, role: 'technician',
      phone, address,
      working_days: workingDays.length > 0 ? workingDays : [1,2,3,4,5]
    })
    if (profileError) {
      await admin.auth.admin.deleteUser(authUser.user.id)
      return fail(400, { error: profileError.message })
    }
    return { success: true }
  },

  deleteTechnician: async ({ request, locals }) => {
    const form = await request.formData()
    const userId = form.get('userId') as string
    if (userId === locals.user!.id)
      return fail(400, { error: "You can't delete yourself" })
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin.auth.admin.deleteUser(userId)
    await admin.from('users').delete().eq('id', userId)
    return { success: true }
  }
}