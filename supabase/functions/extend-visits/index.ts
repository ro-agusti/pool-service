import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const HORIZON_DAYS = 42

Deno.serve(async (req) => {
  const cronSecret = req.headers.get('x-cron-secret')
if (cronSecret !== Deno.env.get('CRON_SECRET')) {
  return new Response('Unauthorized', { status: 401 })
}

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const horizon = toStr(...addDays(ty, tm, td, HORIZON_DAYS))

  const { data: plans, error: plansErr } = await admin
    .from('service_plans')
    .select('id, org_id, property_id, technician_id, recurrence, preferred_day_of_week, preferred_time, start_date, end_date')
    .eq('active', true)
    .or(`end_date.is.null,end_date.gte.${todayStr}`)

  if (plansErr || !plans) {
    return Response.json({ error: plansErr?.message }, { status: 500 })
  }

  let extended = 0
  let skipped = 0
  const errors: string[] = []

  for (const plan of plans) {
    try {
      const { data: lastVisit } = await admin
        .from('visits')
        .select('scheduled_date')
        .eq('service_plan_id', plan.id)
        .eq('status', 'pending')
        .order('scheduled_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const lastDate = lastVisit?.scheduled_date ?? todayStr

      if (lastDate >= horizon) {
        skipped++
        continue
      }

      const generateFrom = lastDate > todayStr ? lastDate : todayStr
      const visits = buildVisits(plan, generateFrom, horizon, todayStr)

      if (visits.length > 0) {
        const { error: insertErr } = await admin.from('visits').insert(visits)
        if (insertErr) {
          errors.push(`plan ${plan.id}: ${insertErr.message}`)
        } else {
          extended++
        }
      } else {
        skipped++
      }
    } catch (e) {
      errors.push(`plan ${plan.id}: ${String(e)}`)
    }
  }

  return Response.json({
    ok: true,
    today: todayStr,
    horizon,
    plans_checked: plans.length,
    extended,
    skipped,
    errors
  })
})

// ─── Helpers ───────────────────────────────────────────────

function dowOf(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  const yr = m < 3 ? y - 1 : y
  const dow = (yr + Math.floor(yr/4) - Math.floor(yr/100) + Math.floor(yr/400) + t[m-1] + d) % 7
  return (dow + 6) % 7
}

function addDays(y: number, m: number, d: number, days: number): [number, number, number] {
  const months = [0,31,28,31,30,31,30,31,31,30,31,30,31]
  const isLeap = (yr: number) => yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)
  d += days
  while (true) {
    const dim = months[m] + (m === 2 && isLeap(y) ? 1 : 0)
    if (d <= dim) break
    d -= dim; m++
    if (m > 12) { m = 1; y++ }
  }
  return [y, m, d]
}

function toStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

function compareDate(ay: number, am: number, ad: number, by: number, bm: number, bd: number): number {
  if (ay !== by) return ay - by
  if (am !== bm) return am - bm
  return ad - bd
}

function buildVisits(
  plan: { id: string; org_id: string; property_id: string; technician_id: string; recurrence: string; preferred_day_of_week: number; preferred_time: string; end_date: string | null },
  from: string,
  until: string,
  today: string
) {
  const intervalDays = plan.recurrence === 'weekly' ? 7 : plan.recurrence === 'fortnightly' ? 14 : 28
  const effectiveEnd = plan.end_date && plan.end_date < until ? plan.end_date : until

  const [ty, tm, td] = today.split('-').map(Number)
  const [fy, fm, fd] = from.split('-').map(Number)

  // Punto de partida: el mayor entre from y today
  let [cy, cm, cd] = compareDate(fy, fm, fd, ty, tm, td) >= 0
    ? [fy, fm, fd]
    : [ty, tm, td]

  // Avanzar al primer día que coincide con preferred_day_of_week
  const offset = (plan.preferred_day_of_week - dowOf(cy, cm, cd) + 7) % 7
  if (offset > 0) [cy, cm, cd] = addDays(cy, cm, cd, offset)

  const [ey, em, ed] = effectiveEnd.split('-').map(Number)
  const visits = []

  while (compareDate(cy, cm, cd, ey, em, ed) <= 0) {
    visits.push({
      org_id: plan.org_id,
      property_id: plan.property_id,
      service_plan_id: plan.id,
      technician_id: plan.technician_id,
      type: 'recurring',
      scheduled_date: toStr(cy, cm, cd),
      scheduled_time: plan.preferred_time,
      status: 'pending'
    })
    ;[cy, cm, cd] = addDays(cy, cm, cd, intervalDays)
  }

  return visits
}