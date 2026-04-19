import type { PageServerLoad, Actions } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
	const selectedDate = url.searchParams.get('date') ?? today;

	function dowOf(dateStr: string): number {
		const [y, m, d] = dateStr.split('-').map(Number);
		const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
		const yr = m < 3 ? y - 1 : y;
		const dow =
			(yr + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) + t[m - 1] + d) % 7;
		return (dow + 6) % 7;
	}

	function addDaysToStr(dateStr: string, days: number): string {
		const [y, m, d] = dateStr.split('-').map(Number);
		const months = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
		const isLeap = (yr: number) => yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0);
		let cy = y,
			cm = m,
			cd = d + days;
		while (cd < 1) {
			cm--;
			if (cm < 1) {
				cm = 12;
				cy--;
			}
			cd += months[cm] + (cm === 2 && isLeap(cy) ? 1 : 0);
		}
		while (true) {
			const dim = months[cm] + (cm === 2 && isLeap(cy) ? 1 : 0);
			if (cd <= dim) break;
			cd -= dim;
			cm++;
			if (cm > 12) {
				cm = 1;
				cy++;
			}
		}
		return `${cy}-${String(cm).padStart(2, '0')}-${String(cd).padStart(2, '0')}`;
	}

	const isAdmin = locals.user!.role === 'admin';

	const mondayStr = addDaysToStr(selectedDate, -dowOf(selectedDate));
	const weekDays = Array.from({ length: 7 }, (_, i) => addDaysToStr(mondayStr, i));

	const weekQuery = locals.supabase
		.from('visits')
		.select('scheduled_date')
		.gte('scheduled_date', weekDays[0])
		.lte('scheduled_date', weekDays[6]);
	const { data: weekVisits } = await weekQuery.eq('technician_id', locals.user!.id);

	const weekDates = weekDays.map((date) => ({
		date,
		hasVisits: (weekVisits ?? []).some((v: any) => v.scheduled_date === date)
	}));

	const visitsQuery = locals.supabase
		.from('visits')
		.select(
			`
      id, status, scheduled_time, type, notes, skip_reason, technician_id,
      service_plans ( recurrence, preferred_day_of_week ),
      properties (
        id, address, suburb, state, postcode, lat, lng,
        customers ( id, name, phone )
      ),
      invoices ( status )
    `
		)
		.eq('scheduled_date', selectedDate)
		.order('scheduled_time');

	// Ambos roles ven solo sus propias visitas en esta página
	const { data: result } = await visitsQuery.eq('technician_id', locals.user!.id);
	const visitsRaw = result ?? [];

	const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
	const technicianIds = [...new Set(visitsRaw.map((v: any) => v.technician_id).filter(Boolean))];
	let technicianMap: Record<string, string> = {};
	if (technicianIds.length > 0) {
		const { data: techs } = await admin.from('users').select('id, name').in('id', technicianIds);
		technicianMap = Object.fromEntries((techs ?? []).map((t: any) => [t.id, t.name]));
	}

	const visits = visitsRaw.map((v: any) => ({
		...v,
		technician_name: technicianMap[v.technician_id] ?? null
	}));

	const backlogQuery = locals.supabase
		.from('visits')
		.select(
			`
      id, status, scheduled_date,
      properties ( id, address, suburb, lat, lng, customers ( name ) )
    `
		)
		.in('status', ['pending', 'skipped'])
		.lt('scheduled_date', selectedDate)
		.order('scheduled_date');
	const { data: backlogRaw } = await backlogQuery.eq('technician_id', locals.user!.id);
	const backlog = (backlogRaw ?? []).filter((v: any) => v.properties?.lat && v.properties?.lng);

	// Route is per-technician — admins see all visits but no optimized route
	let route = null;
	let routeVisits: any[] = [];

	// Siempre buscar ruta del usuario logueado (admin o técnico)
	const { data: routeData } = await admin
		.from('routes')
		.select('id, status, optimized_at, date, origin_lat, origin_lng')
		.eq('date', selectedDate)
		.eq('technician_id', locals.user!.id)
		.maybeSingle();
	route = routeData ?? null;

	if (route) {
		const { data: rv } = await admin
			.from('route_visits')
			.select(
				`
      id, position, estimated_arrival, estimated_travel_mins, estimated_distance_meters, visit_id,
      visits (
        id, status, scheduled_time,
        properties (
          id, address, suburb, lat, lng,
          customers ( id, name, phone )
        )
      )
    `
			)
			.eq('route_id', route.id)
			.order('position');
		routeVisits = rv ?? [];
	}

	return {
		visits,
		backlog,
		route,
		routeVisits,
		selectedDate,
		today,
		weekDates,
		googleMapsKey: PUBLIC_GOOGLE_MAPS_KEY
	};
};

export const actions: Actions = {
	optimizeRoute: async ({ request, locals }) => {
		const form = await request.formData();
		const selectedDate = form.get('date') as string;
		const visitIds = JSON.parse(form.get('visitIds') as string) as string[];
		const originLat = form.get('originLat') ? Number(form.get('originLat')) : null;
		const originLng = form.get('originLng') ? Number(form.get('originLng')) : null;

		if (visitIds.length === 0) throw redirect(303, `/route?date=${selectedDate}`);

		const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

		const { data: visits } = await admin
			.from('visits')
			.select('id, properties(address, suburb, lat, lng)')
			.in('id', visitIds);

		const validVisits = (visits ?? []).filter((v: any) => v.properties?.lat && v.properties?.lng);

		if (validVisits.length < 2) {
			await saveRoute(
				admin,
				locals.user!,
				selectedDate,
				validVisits.map((v: any, i: number) => ({
					visit_id: v.id,
					position: i + 1,
					estimated_arrival: null,
					estimated_travel_mins: null,
					estimated_distance_meters: null
				})),
				originLat,
				originLng
			);
			throw redirect(303, `/route?date=${selectedDate}`);
		}

		try {
			const hasOrigin = !!(originLat && originLng);

			const apiOrigin = hasOrigin
				? { latLng: { latitude: originLat!, longitude: originLng! } }
				: {
						latLng: {
							latitude: validVisits[0].properties.lat,
							longitude: validVisits[0].properties.lng
						}
					};

			// Same as origin so Google can freely reorder all visits
			const apiDestination = apiOrigin;

			// All visits as intermediates
			const apiIntermediates = (hasOrigin ? validVisits : validVisits.slice(1)).map((v: any) => ({
				location: { latLng: { latitude: v.properties.lat, longitude: v.properties.lng } }
			}));

			const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Goog-Api-Key': PUBLIC_GOOGLE_MAPS_KEY,
					'X-Goog-FieldMask':
						'routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.distanceMeters'
				},
				body: JSON.stringify({
					origin: { location: apiOrigin },
					destination: { location: apiDestination },
					intermediates: apiIntermediates,
					travelMode: 'DRIVE',
					optimizeWaypointOrder: true
				})
			});

			const apiData = await res.json();
			const apiRoute = apiData.routes?.[0];
			const optimizedOrder: number[] = apiRoute?.optimizedIntermediateWaypointIndex ?? [];
			const legs: any[] = apiRoute?.legs ?? [];

			const intermediateVisits = hasOrigin ? validVisits : validVisits.slice(1);
			const reordered = [
				...(hasOrigin ? [] : [validVisits[0]]),
				...optimizedOrder.map((i: number) => intermediateVisits[i])
			].filter(Boolean);

			const now = new Date();
			let currentMins = now.getHours() * 60 + now.getMinutes();

			const routeVisitsData = reordered.map((v: any, i: number) => {
				const durStr = legs[i]?.duration ?? '0s';
				const distMeters = legs[i]?.distanceMeters ?? 0;
				const travelSecs = parseInt(durStr.replace('s', ''));
				const travelMins = Math.round(travelSecs / 60);
				currentMins += travelMins;
				const h = Math.floor(currentMins / 60) % 24;
				const m = currentMins % 60;
				const arrival = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
				return {
					visit_id: v.id,
					position: i + 1,
					estimated_arrival: arrival,
					estimated_travel_mins: travelMins,
					estimated_distance_meters: distMeters
				};
			});

			await saveRoute(admin, locals.user!, selectedDate, routeVisitsData, originLat, originLng);
		} catch (e) {
			console.error('Routes API error:', e);
			await saveRoute(
				admin,
				locals.user!,
				selectedDate,
				validVisits.map((v: any, i: number) => ({
					visit_id: v.id,
					position: i + 1,
					estimated_arrival: null,
					estimated_travel_mins: null,
					estimated_distance_meters: null
				})),
				originLat,
				originLng
			);
		}

		throw redirect(303, `/route?date=${selectedDate}`);
	}
};

async function saveRoute(
	admin: any,
	user: any,
	date: string,
	routeVisits: any[],
	originLat: number | null,
	originLng: number | null
) {
	const { data: existing } = await admin
		.from('routes')
		.select('id')
		.eq('date', date)
		.eq('technician_id', user.id)
		.maybeSingle();

	if (existing) {
		await admin.from('route_visits').delete().eq('route_id', existing.id);
		await admin.from('routes').delete().eq('id', existing.id);
	}

	const { data: route } = await admin
		.from('routes')
		.insert({
			org_id: user.org_id,
			technician_id: user.id,
			date,
			status: 'active',
			optimized_at: new Date().toISOString(),
			origin_lat: originLat,
			origin_lng: originLng
		})
		.select('id')
		.single();

	if (route && routeVisits.length > 0) {
		await admin
			.from('route_visits')
			.insert(routeVisits.map((rv) => ({ ...rv, route_id: route.id })));
	}
}
