import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  return {
    user: locals.user ?? null,
    session: locals.user ? true : false
  }
}