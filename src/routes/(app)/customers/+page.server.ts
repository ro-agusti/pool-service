import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
  const search = url.searchParams.get('search') ?? ''

  let query = locals.supabase
    .from('customers')
    .select('id, name, email, phone, created_at')
    .order('name')

  if (search) query = query.ilike('name', `%${search}%`)

  const { data: customers } = await query

  return { customers: customers ?? [], search }
}