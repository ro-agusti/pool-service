import { createClient } from '$lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname === '/reset-password') {
    event.locals.supabase = createClient(event.cookies)
    event.locals.user = null
    return resolve(event)
  }

  const supabase = createClient(event.cookies)
  event.locals.supabase = supabase

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const admin = createAdminClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await admin
      .from('users')
      .select('id, org_id, role, name, email')
      .eq('id', user.id)
      .single()
    event.locals.user = profile ?? null
  } else {
    event.locals.user = null
  }

  return resolve(event, {
    filterSerializedResponseHeaders: (name) =>
      name === 'content-range' || name === 'x-supabase-api-version'
  })
}