// src/routes/(app)/customers/map/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { redirect } from '@sveltejs/kit';

// ─── Haversine distance in km ─────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Auto-assign algorithm ────────────────────────────────────────────────────
// For each property with an active plan:
// 1. Find eligible technicians (work on the plan's preferred_day_of_week)
// 2. Sort by distance to property
// 3. Assign to the closest tech who is under the load cap
// Returns array of { planId, propertyId, technicianId, reason }
function autoAssign(
	properties: any[],
	technicians: any[]
): Array<{
	planId: string;
	propertyId: string;
	technicianId: string;
	currentTechId: string;
	reason: string;
}> {
	const activeTechs = technicians.filter((t: any) => t.lat && t.lng);
	if (activeTechs.length === 0) return [];

	const activeIds = new Set(activeTechs.map((t: any) => t.id));
	const propertiesWithPlan = properties.filter((p: any) => p.active_plan && p.lat && p.lng);
	const loadCap = Math.ceil(propertiesWithPlan.length / activeTechs.length)
	const loadMap: Record<string, number> = Object.fromEntries(
		activeTechs.map((t: any) => [t.id, 0])
	);

	const assignments: any[] = [];

	// Hardest to assign first (fewest eligible techs)
	const sorted = [...propertiesWithPlan].sort((a: any, b: any) => {
		const dowA = a.active_plan.preferred_day_of_week;
		const dowB = b.active_plan.preferred_day_of_week;
		const eligA = activeTechs.filter((t: any) =>
			(t.working_days ?? [1, 2, 3, 4, 5]).includes(dowA)
		).length;
		const eligB = activeTechs.filter((t: any) =>
			(t.working_days ?? [1, 2, 3, 4, 5]).includes(dowB)
		).length;
		return eligA - eligB;
	});

	for (const prop of sorted) {
		const dow = prop.active_plan.preferred_day_of_week;
		const currentTechId = prop.active_plan.technician_id ?? null;

		const eligible = activeTechs.filter((t: any) =>
			(t.working_days ?? [1, 2, 3, 4, 5]).includes(dow)
		);

		if (eligible.length === 0) continue;

		const ranked = eligible
			.map((t: any) => ({
				...t,
				dist: haversine(prop.lat, prop.lng, t.lat, t.lng),
				load: loadMap[t.id] ?? 0
			}))
			.sort((a: any, b: any) => {
				// Primary: least loaded first
				if (a.load !== b.load) return a.load - b.load;
				// Secondary: closest
				return a.dist - b.dist;
			});

		const best = ranked[0];
		loadMap[best.id] = (loadMap[best.id] ?? 0) + 1;

		assignments.push({
			planId: prop.active_plan.id,
			propertyId: prop.id,
			technicianId: best.id,
			// Si el técnico actual no está en el pool activo, marcar como null para forzar el cambio
			currentTechId: activeIds.has(currentTechId) ? currentTechId : null,
			distKm: Math.round(best.dist),
			reason: `${Math.round(best.dist)} km from ${best.name}'s home`
		});
	}

	return assignments;
}

// ─── Load ─────────────────────────────────────────────────────────────────────
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'admin') throw redirect(303, '/customers');

	const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
	const org_id = locals.user!.org_id;

	const { data: properties } = await admin
		.from('properties')
		.select(
			`
      id, address, suburb, lat, lng,
      customers ( id, name ),
      service_plans (
        id, technician_id, recurrence, active,
        preferred_day_of_week, preferred_time, start_date
      )
    `
		)
		.eq('org_id', org_id)
		.not('lat', 'is', null)
		.not('lng', 'is', null);

	const { data: technicians } = await admin
		.from('users')
		.select('id, name, lat, lng, working_days')
		.eq('org_id', org_id)
		.eq('active', true)
		.order('name');

	const technicianMap = Object.fromEntries((technicians ?? []).map((t: any) => [t.id, t.name]));

	const propertiesWithPlan = (properties ?? []).map((p: any) => {
		const activePlan = (p.service_plans ?? []).find((sp: any) => sp.active) ?? null;
		return {
			...p,
			active_plan: activePlan,
			technician_id: activePlan?.technician_id ?? null,
			technician_name: activePlan
				? (technicianMap[activePlan.technician_id] ?? 'Unassigned')
				: null,
			service_plans: undefined
		};
	});

	return {
		properties: propertiesWithPlan,
		technicians: technicians ?? [],
		googleMapsKey: PUBLIC_GOOGLE_MAPS_KEY
	};
};

// ─── Actions ──────────────────────────────────────────────────────────────────
export const actions: Actions = {
	reassignTechnician: async ({ request, locals }) => {
		const form = await request.formData();
		const planId = form.get('planId') as string;
		const technicianId = form.get('technicianId') as string;
		const propertyId = form.get('propertyId') as string;

		const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
		const { data: plan } = await admin.from('service_plans').select('*').eq('id', planId).single();
		if (!plan) return;

		await admin.from('service_plans').update({ technician_id: technicianId }).eq('id', planId);

		const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
		await admin
			.from('visits')
			.delete()
			.eq('service_plan_id', planId)
			.eq('status', 'pending')
			.gte('scheduled_date', todayStr);

		const generateFrom = plan.start_date > todayStr ? plan.start_date : todayStr;
		await generateVisits(
			planId,
			propertyId,
			locals.user!.org_id,
			technicianId,
			plan.recurrence,
			plan.preferred_day_of_week,
			plan.preferred_time,
			generateFrom,
			admin
		);
	},

// 	computeAutoAssign: async ({ request }) => {
//   const form = await request.formData()
//   const propertiesRaw  = JSON.parse(form.get('properties') as string)
//   const techniciansRaw = JSON.parse(form.get('technicians') as string)

//   console.log('Technicians received:', techniciansRaw.map((t: any) => ({ name: t.name, lat: t.lat, lng: t.lng })))
//   console.log('Total properties:', propertiesRaw.length)

//   const assignments = autoAssign(propertiesRaw, techniciansRaw)
  
//   // ← AGREGAR ACÁ
//   console.log('Matias assignments:', assignments
//     .filter((a: any) => a.technicianId === '6de9e18a-0a0e-474b-89c5-2f1867e42c71')
//     .map((a: any) => ({ currentTechId: a.currentTechId, technicianId: a.technicianId, same: a.currentTechId === a.technicianId }))
//   )

//   console.log('Assignments:', assignments.map((a: any) => ({ tech: a.technicianId, prop: a.propertyId })))

//   return { assignments }
// },

	applyAutoAssign: async ({ request, locals }) => {
		const form = await request.formData();
		const assignments = JSON.parse(form.get('assignments') as string) as {
			planId: string;
			propertyId: string;
			technicianId: string;
		}[];

		const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
		const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });

		for (const rec of assignments) {
			const { data: plan } = await admin
				.from('service_plans')
				.select('*')
				.eq('id', rec.planId)
				.single();
			if (!plan) continue;

			await admin
				.from('service_plans')
				.update({ technician_id: rec.technicianId })
				.eq('id', rec.planId);
			await admin
				.from('visits')
				.delete()
				.eq('service_plan_id', rec.planId)
				.eq('status', 'pending')
				.gte('scheduled_date', todayStr);

			const generateFrom = plan.start_date > todayStr ? plan.start_date : todayStr;
			await generateVisits(
				rec.planId,
				rec.propertyId,
				locals.user!.org_id,
				rec.technicianId,
				plan.recurrence,
				plan.preferred_day_of_week,
				plan.preferred_time,
				generateFrom,
				admin
			);
		}
	}
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dowOf(y: number, m: number, d: number): number {
	const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
	const yr = m < 3 ? y - 1 : y;
	const dow =
		(yr + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) + t[m - 1] + d) % 7;
	return (dow + 6) % 7;
}

function addDays(y: number, m: number, d: number, days: number): [number, number, number] {
	const months = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	const isLeap = (yr: number) => yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0);
	d += days;
	while (true) {
		const dim = months[m] + (m === 2 && isLeap(y) ? 1 : 0);
		if (d <= dim) break;
		d -= dim;
		m++;
		if (m > 12) {
			m = 1;
			y++;
		}
	}
	return [y, m, d];
}

function toStr(y: number, m: number, d: number): string {
	return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function compareDate(
	ay: number,
	am: number,
	ad: number,
	by: number,
	bm: number,
	bd: number
): number {
	if (ay !== by) return ay - by;
	if (am !== bm) return am - bm;
	return ad - bd;
}

async function generateVisits(
	planId: string,
	propertyId: string,
	orgId: string,
	technicianId: string,
	recurrence: string,
	targetDow: number,
	time: string,
	startDate: string,
	admin: any
) {
	const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
	const [ty, tm, td] = todayStr.split('-').map(Number);
	const [ly, lm, ld] = addDays(ty, tm, td, 42);
	const [sy, sm, sd] = startDate.split('-').map(Number);
	let [cy, cm, cd] = compareDate(sy, sm, sd, ty, tm, td) >= 0 ? [sy, sm, sd] : [ty, tm, td];
	const offset = (targetDow - dowOf(cy, cm, cd) + 7) % 7;
	if (offset > 0) [cy, cm, cd] = addDays(cy, cm, cd, offset);
	if (compareDate(cy, cm, cd, ly, lm, ld) > 0) return;
	const intervalDays = recurrence === 'weekly' ? 7 : recurrence === 'fortnightly' ? 14 : 28;
	const visits: any[] = [];
	while (compareDate(cy, cm, cd, ly, lm, ld) <= 0) {
		visits.push({
			org_id: orgId,
			property_id: propertyId,
			service_plan_id: planId,
			technician_id: technicianId,
			type: 'recurring',
			scheduled_date: toStr(cy, cm, cd),
			scheduled_time: time,
			status: 'pending'
		});
		[cy, cm, cd] = addDays(cy, cm, cd, intervalDays);
	}
	if (visits.length > 0) await admin.from('visits').insert(visits);
}
