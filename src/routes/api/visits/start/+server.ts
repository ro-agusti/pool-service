import { redirect } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, locals }) => {
  const form = await request.formData()
  const visitId   = form.get('visitId') as string
  const oldStatus = form.get('oldStatus') as string
  const fromRoute = form.get('fromRoute') === 'true'

  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  await admin.from('visits').update({ status: 'in_progress' }).eq('id', visitId)
  await admin.from('visit_logs').insert({
    visit_id: visitId,
    org_id: locals.user!.org_id,
    changed_by: locals.user!.id,
    old_status: oldStatus,
    new_status: 'in_progress'
  })

  throw redirect(303, `/visits/${visitId}${fromRoute ? '?from=route' : ''}`)
}
