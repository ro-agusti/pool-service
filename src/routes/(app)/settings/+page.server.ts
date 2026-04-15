import type { PageServerLoad, Actions } from './$types'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'

export const load: PageServerLoad = async ({ locals }) => {
  const { data: orgSettings } = await locals.supabase
    .from('org_settings')
    .select('*')
    .eq('org_id', locals.user!.org_id)
    .maybeSingle()

  return { orgSettings: orgSettings ?? null }
}

export const actions: Actions = {
  saveSettings: async ({ request, locals }) => {
    const form = await request.formData()
    const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    await admin.from('org_settings').upsert({
      org_id: locals.user!.org_id,
      business_name: form.get('business_name') as string || null,
      address:       form.get('address')       as string || null,
      suburb:        form.get('suburb')         as string || null,
      state:         form.get('state')          as string || null,
      postcode:      form.get('postcode')       as string || null,
      phone:         form.get('phone')          as string || null,
      email:         form.get('email')          as string || null,
      abn:           form.get('abn')            as string || null,
    }, { onConflict: 'org_id' })
  }
}