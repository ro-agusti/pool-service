import { json } from '@sveltejs/kit'
import { createAdminClient } from '$lib/supabase/server'

export async function POST({ request, locals }) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 })

  const { visitId, status, notes } = await request.json()

  const admin = createAdminClient()
  await admin.from('visits').update({ status, notes }).eq('id', visitId)
  await admin.from('visit_logs').insert({
    visit_id: visitId,
    org_id: locals.user.org_id,
    changed_by: locals.user.id,
    new_status: status,
    reason: 'offline-sync'
  })

  return json({ ok: true })
}