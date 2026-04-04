import { createClient } from '$lib/supabase/server'
import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  const supabase = createClient(event.cookies)
  event.locals.supabase = supabase

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('id, org_id, role, name, email')
      .eq('id', user.id)
      .single()
    event.locals.user = profile ?? null
  } else {
    event.locals.user = null
  }

  return resolve(event, {
    filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version'
  })
}