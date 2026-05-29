// src/routes/api/xero/connect/+server.ts
import { redirect } from '@sveltejs/kit'
import { XERO_CLIENT_ID, XERO_REDIRECT_URI } from '$env/static/private'
import type { RequestHandler } from './$types'

const XERO_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.contacts',
  'accounting.contacts.read',
  'accounting.invoices',
  'accounting.invoices.read'
].join(' ')

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user || locals.user.role !== 'admin') {
    throw redirect(303, '/settings')
  }

  const state = locals.user.org_id

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: XERO_CLIENT_ID,
    redirect_uri: XERO_REDIRECT_URI,
    scope: XERO_SCOPES,
    state
  })

  throw redirect(303, `https://login.xero.com/identity/connect/authorize?${params}`)
}