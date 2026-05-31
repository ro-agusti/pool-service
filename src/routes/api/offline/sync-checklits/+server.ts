import { json } from '@sveltejs/kit'
import { createAdminClient } from '$lib/supabase/server'

export async function POST({ request, locals }) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 })

  const { visitId, photos, tasks_completed, chemicals_added,
          ph, chlorine, alkalinity, stabiliser, salt, calcium_hardness, notes } = await request.json()

  const admin = createAdminClient()
  const { error } = await admin.from('visit_checklists').upsert({
    visit_id: visitId,
    org_id: locals.user.org_id,
    photos: JSON.parse(photos ?? '[]'),
    tasks_completed: JSON.parse(tasks_completed ?? '[]'),
    chemicals_added: JSON.parse(chemicals_added ?? '[]'),
    ph: ph ? parseFloat(ph) : null,
    chlorine: chlorine ? parseFloat(chlorine) : null,
    alkalinity: alkalinity ? parseFloat(alkalinity) : null,
    stabiliser: stabiliser ? parseFloat(stabiliser) : null,
    salt: salt ? parseFloat(salt) : null,
    calcium_hardness: calcium_hardness ? parseFloat(calcium_hardness) : null,
    notes: notes || null,
    completed_at: new Date().toISOString()
  }, { onConflict: 'visit_id' })

  if (error) return json({ error: error.message }, { status: 500 })
  return json({ ok: true })
}