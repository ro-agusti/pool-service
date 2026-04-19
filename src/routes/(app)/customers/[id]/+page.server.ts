import { error, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data: customer } = await locals.supabase
		.from('customers')
		.select('*')
		.eq('id', params.id)
		.single();

	if (!customer) throw error(404, 'Customer not found');

	const isAdmin = locals.user?.role === 'admin';
	const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	let properties: any[] = [];
	if (isAdmin) {
		const { data } = await locals.supabase
			.from('properties')
			.select('id, address, suburb, state, postcode, pool_type, pool_volume_litres')
			.eq('customer_id', params.id)
			.order('address');
		properties = data ?? [];
	} else {
		const { data: visits } = await locals.supabase
			.from('visits')
			.select('property_id')
			.eq('technician_id', locals.user!.id);
		const propertyIds = [...new Set((visits ?? []).map((v: any) => v.property_id).filter(Boolean))];
		if (propertyIds.length > 0) {
			const { data } = await locals.supabase
				.from('properties')
				.select('id, address, suburb, state, postcode, pool_type, pool_volume_litres')
				.eq('customer_id', params.id)
				.in('id', propertyIds)
				.order('address');
			properties = data ?? [];
		}
	}

	// Invoices for all properties of this customer
	const propertyIds = properties.map((p: any) => p.id);
	let invoices: any[] = [];
	if (propertyIds.length > 0) {
		const { data } = await admin
			.from('invoices')
			.select(
				`
        id, invoice_number, status, due_date, paid_at,
        visits ( id, scheduled_date, property_id,
          properties ( address, suburb )
        )
      `
			)
			.eq('org_id', locals.user!.org_id)
			.order('id', { ascending: false });
		invoices = (data ?? []).filter((inv: any) => propertyIds.includes(inv.visits?.property_id));
	}

	return { customer, properties, invoices };
};

export const actions: Actions = {
	deleteProperty: async ({ request }) => {
		const form = await request.formData();
		const propertyId = form.get('propertyId') as string;
		const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
		await admin.from('properties').delete().eq('id', propertyId);
	},
	deleteCustomer: async ({ params }) => {
		const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
		await admin.from('customers').delete().eq('id', params.id);
		throw redirect(303, '/customers');
	}
};
