import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
  const search = url.searchParams.get('search') ?? ''
  const isAdmin = locals.user?.role === 'admin'

  if (isAdmin) {
    // Admin ve todos
    let query = locals.supabase
      .from('customers')
      .select('id, name, email, phone, created_at')
      .order('name')
    if (search) query = query.ilike('name', `%${search}%`)
    const { data: customers } = await query
    return { customers: customers ?? [], search }
  } else {
    // Técnico — solo customers con propiedades que tienen visitas suyas
    const { data: visits } = await locals.supabase
      .from('visits')
      .select('properties(customer_id)')
      .eq('technician_id', locals.user!.id)

    const customerIds = [...new Set(
      (visits ?? [])
        .map((v: any) => v.properties?.customer_id)
        .filter(Boolean)
    )]

    if (customerIds.length === 0) return { customers: [], search }

    let query = locals.supabase
      .from('customers')
      .select('id, name, email, phone, created_at')
      .in('id', customerIds)
      .order('name')
    if (search) query = query.ilike('name', `%${search}%`)
    const { data: customers } = await query
    return { customers: customers ?? [], search }
  }
}