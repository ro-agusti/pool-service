import { redirect, fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(303, '/dashboard')
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const form = await request.formData()
    const email = form.get('email') as string
    const password = form.get('password') as string

    const { error } = await locals.supabase.auth.signInWithPassword({ email, password })

    if (error) return fail(400, { error: error.message, email })

    throw redirect(303, '/dashboard')
  }
}