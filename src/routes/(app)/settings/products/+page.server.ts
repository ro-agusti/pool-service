import { fail } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const { data: products } = await locals.supabase
    .from('products')
    .select('*')
    .eq('org_id', locals.user!.org_id)
    .order('sort_order')

  return { products: products ?? [] }
}

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const form = await request.formData()
    const name        = form.get('name') as string
    const unit        = form.get('unit') as string
    const unit_price  = parseFloat(form.get('unit_price') as string)
    const is_chemical = form.get('is_chemical') === 'true'

    if (!name || isNaN(unit_price)) return fail(400, { error: 'Name and price are required' })

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { error } = await admin.from('products').insert({
      org_id: locals.user!.org_id,
      name, unit, unit_price, is_chemical, active: true
    })

    if (error) return fail(400, { error: error.message })
    return { success: true }
  },

  update: async ({ request }) => {
    const form = await request.formData()
    const id          = form.get('id') as string
    const name        = form.get('name') as string
    const unit        = form.get('unit') as string
    const unit_price  = parseFloat(form.get('unit_price') as string)
    const is_chemical = form.get('is_chemical') === 'true'

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { error } = await admin.from('products')
      .update({ name, unit, unit_price, is_chemical })
      .eq('id', id)

    if (error) return fail(400, { error: error.message })
    return { success: true }
  },

  reorder: async ({ request }) => {
    const form      = await request.formData()
    const id        = form.get('id') as string
    const direction = form.get('direction') as 'up' | 'down'
    const allIds    = (form.get('all_ids') as string).split(',')

    const idx = allIds.indexOf(id)
    if (idx === -1) return { success: false }

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= allIds.length) return { success: true }

    ;[allIds[idx], allIds[swapIdx]] = [allIds[swapIdx], allIds[idx]]

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await Promise.all(
      allIds.map((pid, i) => admin.from('products').update({ sort_order: i + 1 }).eq('id', pid))
    )
    return { success: true }
  },

  delete: async ({ request }) => {
    const form = await request.formData()
    const id   = form.get('id') as string

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin.from('products').delete().eq('id', id)
    return { success: true }
  }
}