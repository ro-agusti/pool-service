import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  return {}
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const form = await request.formData()
    const password = form.get('password') as string
    const confirm  = form.get('confirm') as string

    if (!password || password.length < 6) {
      return fail(400, { error: 'Password must be at least 6 characters' })
    }

    if (password !== confirm) {
      return fail(400, { error: 'Passwords do not match' })
    }

    const { error } = await locals.supabase.auth.updateUser({ password })

    if (error) return fail(400, { error: error.message })

    throw redirect(303, '/login?reset=success')
  }
}