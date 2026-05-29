import { error, redirect, fail } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY, XERO_CLIENT_ID, XERO_CLIENT_SECRET } from '$env/static/private';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const fromCustomer =
		url.searchParams.get('from') === 'customer' ? url.searchParams.get('customerId') : null;

	const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	const { data: visit } = await admin
		.from('visits')
		.select(
			`
      id, scheduled_date, org_id,
      properties (
        id, address, suburb, state, postcode,
        customers ( id, name, email, phone, xero_contact_id )
      )
    `
		)
		.eq('id', params.id)
		.single();

	if (!visit) throw error(404, 'Visit not found');

	const { data: invoice } = await admin
		.from('invoices')
		.select('*')
		.eq('visit_id', params.id)
		.maybeSingle();

	// Check if Xero is connected for this org
	const { data: integration } = await admin
		.from('integrations')
		.select('tenant_id, tenant_name')
		.eq('org_id', locals.user!.org_id)
		.eq('provider', 'xero')
		.maybeSingle();

	// Invoice con snapshot completo
	if (invoice?.lines_snapshot && invoice?.org_snapshot) {
		const lines = invoice.lines_snapshot as any[];
		const total = lines.reduce((sum: number, l: any) => sum + l.total, 0);
		return {
			visit,
			orgSettings: invoice.org_snapshot,
			invoice,
			lines,
			total,
			fromCustomer,
			xeroConnected: !!integration
		};
	}

	// Invoice viejo sin snapshot
	const { data: checklist } = await admin
		.from('visit_checklists')
		.select('tasks_completed, chemicals_added')
		.eq('visit_id', params.id)
		.maybeSingle();

	const { data: products } = await admin
		.from('products')
		.select('id, name, unit_price, unit, is_chemical')
		.eq('org_id', locals.user!.org_id);

	const orgSettings =
		invoice?.org_snapshot ??
		(await admin
			.from('org_settings')
			.select('*')
			.eq('org_id', locals.user!.org_id)
			.maybeSingle()
			.then((r) => r.data));

	const productMap = new Map((products ?? []).map((p) => [p.id, p]));

	const serviceLines = (checklist?.tasks_completed ?? [])
		.map((id: string) => {
			const p = productMap.get(id);
			if (!p) return null;
			return { name: p.name, qty: 1, unit: p.unit, unit_price: p.unit_price, total: p.unit_price };
		})
		.filter(Boolean);

	const chemicalLines = (checklist?.chemicals_added ?? [])
		.filter((c: any) => c.amount > 0)
		.map((c: any) => ({
			name: c.name,
			qty: c.amount,
			unit: c.unit,
			unit_price: c.unit_price ?? 0,
			total: c.amount * (c.unit_price ?? 0)
		}));

	const lines = [...serviceLines, ...chemicalLines];
	const total = lines.reduce((sum, l) => sum + l!.total, 0);

	return {
		visit,
		orgSettings,
		invoice: invoice ?? null,
		lines,
		total,
		fromCustomer,
		xeroConnected: !!integration
	};
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getValidXeroToken(
	admin: any,
	orgId: string
): Promise<{ token: string; tenantId: string } | null> {
	const { data } = await admin
		.from('integrations')
		.select('tenant_id, access_token, refresh_token, token_expires_at')
		.eq('org_id', orgId)
		.eq('provider', 'xero')
		.maybeSingle();

	if (!data) return null;

	const expiresAt = new Date(data.token_expires_at).getTime();
	const needsRefresh = expiresAt < Date.now() + 60_000;

	if (!needsRefresh) {
		return { token: data.access_token, tenantId: data.tenant_id };
	}

	// Refresh the token
	const res = await fetch('https://identity.xero.com/connect/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: data.refresh_token
		})
	});

	if (!res.ok) return null;

	const tokens = (await res.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
	};
	const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

	await admin
		.from('integrations')
		.update({
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			token_expires_at: newExpiry
		})
		.eq('org_id', orgId)
		.eq('provider', 'xero');

	return { token: tokens.access_token, tenantId: data.tenant_id };
}

// ── Actions ───────────────────────────────────────────────────────────────────

export const actions: Actions = {
	create: async ({ params, locals, request }) => {
		const form = await request.formData();
		const fromCustomer = form.get('fromCustomer') as string | null;
		const suffix = fromCustomer ? `?from=customer&customerId=${fromCustomer}` : '';
		const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

		const { data: existing } = await admin
			.from('invoices')
			.select('id')
			.eq('visit_id', params.id)
			.maybeSingle();
		if (existing) throw redirect(303, `/visits/${params.id}/invoice${suffix}`);

		const { data: orgSettings } = await admin
			.from('org_settings')
			.select('*')
			.eq('org_id', locals.user!.org_id)
			.maybeSingle();

		const { data: visit } = await admin
			.from('visits')
			.select(
				`id, scheduled_date, org_id, properties(id, address, suburb, state, postcode, customers(id, name, email, phone))`
			)
			.eq('id', params.id)
			.single();

		const { data: checklist } = await admin
			.from('visit_checklists')
			.select('tasks_completed, chemicals_added')
			.eq('visit_id', params.id)
			.maybeSingle();

		const { data: products } = await admin
			.from('products')
			.select('id, name, unit_price, unit')
			.eq('org_id', locals.user!.org_id);

		const productMap = new Map((products ?? []).map((p) => [p.id, p]));

		const serviceLines = (checklist?.tasks_completed ?? [])
			.map((id: string) => {
				const p = productMap.get(id);
				if (!p) return null;
				return {
					name: p.name,
					qty: 1,
					unit: p.unit,
					unit_price: p.unit_price,
					total: p.unit_price
				};
			})
			.filter(Boolean);

		const chemicalLines = (checklist?.chemicals_added ?? [])
			.filter((c: any) => c.amount > 0)
			.map((c: any) => ({
				name: c.name,
				qty: c.amount,
				unit: c.unit,
				unit_price: c.unit_price ?? 0,
				total: c.amount * (c.unit_price ?? 0)
			}));

		const lines = [...serviceLines, ...chemicalLines];

		const { count } = await admin
			.from('invoices')
			.select('*', { count: 'exact', head: true })
			.eq('org_id', locals.user!.org_id);

		const invoice_number = 1000001 + (count ?? 0);

		await admin.from('invoices').insert({
			org_id: locals.user!.org_id,
			visit_id: params.id,
			status: 'pending',
			invoice_number,
			org_snapshot: orgSettings ?? null,
			lines_snapshot: lines
		});

		throw redirect(303, `/visits/${params.id}/invoice${suffix}`);
	},

	markPaid: async ({ params, locals, request }) => {
  const form = await request.formData()
  const fromCustomer = form.get('fromCustomer') as string | null
  const suffix = fromCustomer ? `?from=customer&customerId=${fromCustomer}` : ''

  const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Marcar como paid en ClearWave
  const { data: invoice } = await admin
    .from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('visit_id', params.id)
    .select('id, xero_invoice_id')
    .single()

  // Si tiene xero_invoice_id, actualizar en Xero también
  if (invoice?.xero_invoice_id) {
    const auth = await getValidXeroToken(admin, locals.user!.org_id)

    if (auth) {
      const res = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${invoice.xero_invoice_id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Xero-tenant-id': auth.tenantId,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          Invoices: [{
            InvoiceID: invoice.xero_invoice_id,
            Status: 'AUTHORISED'
          }]
        })
      })
      const text = await res.text()
      console.log('Xero markPaid →', res.status, text.slice(0, 200))
    }
  }

  throw redirect(303, `/visits/${params.id}/invoice${suffix}`)
},

	syncXero: async ({ params, locals, request }) => {
		const form = await request.formData();
		const fromCustomer = form.get('fromCustomer') as string | null;

		const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

		// 1. Get invoice + lines
		const { data: invoice } = await admin
			.from('invoices')
			.select('*')
			.eq('visit_id', params.id)
			.maybeSingle();

		if (!invoice) return fail(400, { xeroError: 'Invoice not saved yet' });
		if (invoice.xero_invoice_id) return fail(400, { xeroError: 'Already synced to Xero' });

		const lines: any[] = invoice.lines_snapshot ?? [];

		// 2. Get visit + customer
		const { data: visit } = await admin
			.from('visits')
			.select(`id, scheduled_date, org_id, properties(customers(id, name, email, xero_contact_id))`)
			.eq('id', params.id)
			.single();

		if (!visit) return fail(404, { xeroError: 'Visit not found' });

		const customer = (visit.properties as any)?.customers;

		// 3. Get valid Xero token
		const auth = await getValidXeroToken(admin, locals.user!.org_id);
		if (!auth) return fail(400, { xeroError: 'Xero not connected. Go to Settings → Integrations.' });

		// Helper: xero fetch that always requests JSON
		const xeroGet = async (url: string) => {
			const res = await fetch(url, {
				headers: {
					Authorization: `Bearer ${auth.token}`,
					'Xero-tenant-id': auth.tenantId,
					Accept: 'application/json'
				}
			});
			const text = await res.text();
			try { return { ok: res.ok, data: JSON.parse(text) }; }
			catch { console.error('Xero GET parse error:', text); return { ok: false, data: null }; }
		};

		const xeroPost = async (url: string, body: any, method = 'PUT') => {
			const res = await fetch(url, {
				method,
				headers: {
					Authorization: `Bearer ${auth.token}`,
					'Xero-tenant-id': auth.tenantId,
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				body: JSON.stringify(body)
			});
			const text = await res.text();
			console.log(`Xero ${method} ${url} →`, res.status, text);
			try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
			catch { return { ok: false, status: res.status, data: null }; }
		};

		// 4. Find or create contact
		let xeroContactId = customer?.xero_contact_id ?? null;

		if (!xeroContactId && customer) {
			// Search by email
			if (customer.email) {
				const { ok, data } = await xeroGet(
					`https://api.xero.com/api.xro/2.0/Contacts?where=EmailAddress%3D%3D%22${encodeURIComponent(customer.email)}%22`
				);
				if (ok && data?.Contacts?.length) xeroContactId = data.Contacts[0].ContactID;
			}

			// Search by name
			if (!xeroContactId) {
				const { ok, data } = await xeroGet(
					`https://api.xero.com/api.xro/2.0/Contacts?where=Name%3D%3D%22${encodeURIComponent(customer.name)}%22`
				);
				if (ok && data?.Contacts?.length) xeroContactId = data.Contacts[0].ContactID;
			}

			// Create if still not found
			if (!xeroContactId) {
				const { ok, data } = await xeroPost('https://api.xero.com/api.xro/2.0/Contacts', {
					Contacts: [{ Name: customer.name, EmailAddress: customer.email ?? undefined }]
				});
				if (ok) xeroContactId = data?.Contacts?.[0]?.ContactID ?? null;
			}

			if (xeroContactId) {
				await admin.from('customers').update({ xero_contact_id: xeroContactId }).eq('id', customer.id);
			}
		}

		if (!xeroContactId) return fail(500, { xeroError: 'Could not find or create contact in Xero' });

		// 5. Create invoice in Xero
		const dueDate = new Date(visit.scheduled_date);
		dueDate.setDate(dueDate.getDate() + 14);
		const dueDateStr = dueDate.toISOString().split('T')[0];

		const { ok, status, data: invoiceData } = await xeroPost(
			'https://api.xero.com/api.xro/2.0/Invoices',
			{
				Invoices: [{
					Type: 'ACCREC',
					InvoiceNumber: `CW-${invoice.invoice_number}`,
					Contact: { ContactID: xeroContactId },
					DueDate: dueDateStr,
					Status: 'DRAFT',
					//LineAmountTypes: 'EXCLUSIVE',
					LineItems: lines.map((l: any) => ({
						Description: l.name,
						Quantity: l.qty,
						UnitAmount: l.unit_price,
            TaxType: 'OUTPUT'
					}))
				}]
			}
		);

		if (!ok) return fail(500, { xeroError: `Xero rejected the invoice (${status})` });

		const xeroInvoiceId = invoiceData?.Invoices?.[0]?.InvoiceID;
		if (!xeroInvoiceId) return fail(500, { xeroError: 'Xero did not return an invoice ID' });

		// 6. Save xero_invoice_id back to ClearWave
		await admin
			.from('invoices')
			.update({ xero_invoice_id: xeroInvoiceId, xero_synced_at: new Date().toISOString() })
			.eq('id', invoice.id);

		const suffix = fromCustomer ? `?from=customer&customerId=${fromCustomer}` : '';
		throw redirect(303, `/visits/${params.id}/invoice${suffix}?xeroSuccess=1`);
	}
};
