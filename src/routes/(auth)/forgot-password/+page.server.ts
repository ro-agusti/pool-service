import { fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) return { redirect: '/' }
  return {}
}

export const actions: Actions = {
  default: async ({ request, locals, url }) => {
    const form = await request.formData()
    const email = form.get('email') as string

    if (!email) return fail(400, { error: 'Email is required' })

    const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${url.origin}/reset-password`
    })

    if (error) return fail(400, { error: error.message })

    return { success: true }
  }
}