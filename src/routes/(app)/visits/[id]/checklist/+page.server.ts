import { redirect, error } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const { data: visit } = await locals.supabase
    .from('visits')
    .select('id, status, property_id, org_id, properties(address, suburb, customers(name))')
    .eq('id', params.id)
    .single()

  if (!visit) throw error(404, 'Visit not found')

  // Checklist existente si ya fue guardado
  const { data: checklist } = await locals.supabase
    .from('visit_checklists')
    .select('*')
    .eq('visit_id', params.id)
    .single()

  return { visit, checklist: checklist ?? null }
}

export const actions: Actions = {
  save: async ({ request, params, locals }) => {
    const form = await request.formData()

    const general_clean = form.get('general_clean') === 'on'
    const spin_filter   = form.get('spin_filter') === 'on'
    const ph              = form.get('ph') ? Number(form.get('ph')) : null
    const chlorine        = form.get('chlorine') ? Number(form.get('chlorine')) : null
    const alkalinity      = form.get('alkalinity') ? Number(form.get('alkalinity')) : null
    const stabiliser      = form.get('stabiliser') ? Number(form.get('stabiliser')) : null
    const salt            = form.get('salt') ? Number(form.get('salt')) : null
    const calcium_hardness = form.get('calcium_hardness') ? Number(form.get('calcium_hardness')) : null
    const notes         = form.get('notes') as string | null
    const photosRaw     = form.get('photos') as string
    const photos        = photosRaw ? JSON.parse(photosRaw) : []

    // Chemicals — vienen como chemical_name_0, chemical_amount_0, chemical_unit_0...
    const chemicals: { name: string; amount: string; unit: string }[] = []
    let i = 0
    while (form.get(`chemical_name_${i}`) !== null) {
      const name = form.get(`chemical_name_${i}`) as string
      const amount = form.get(`chemical_amount_${i}`) as string
      const unit = form.get(`chemical_unit_${i}`) as string
      if (name?.trim()) chemicals.push({ name, amount, unit })
      i++
    }

    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Upsert — crear o actualizar
    const { data: visit } = await admin
      .from('visits')
      .select('org_id')
      .eq('id', params.id)
      .single()

    await admin.from('visit_checklists').upsert({
      visit_id: params.id,
      org_id: visit?.org_id,
      general_clean,
      spin_filter,
      ph, chlorine, alkalinity, stabiliser, salt, calcium_hardness,
      chemicals_added: chemicals,
      photos,
      notes,
      completed_at: new Date().toISOString()
    }, { onConflict: 'visit_id' })

    throw redirect(303, `/visits/${params.id}`)
  }
}