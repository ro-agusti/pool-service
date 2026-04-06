import { json } from '@sveltejs/kit'
import { ANTHROPIC_API_KEY } from '$env/static/private'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
  const { currentLat, currentLng, visits, backlog, currentTime } = await request.json()

  const visitLines = visits.map((v: any) =>
    `- [${v.id}] ${v.address}, ${v.suburb} (${v.status}) — ${v.customerName}${v.estimatedArrival ? ` · ETA ${v.estimatedArrival}` : ''}${v.lat ? ` [${v.lat},${v.lng}]` : ''}`
  ).join('\n')

  const backlogLines = backlog.length > 0
    ? backlog.map((v: any) => `- [${v.id}] ${v.address}, ${v.suburb} — overdue ${v.daysOverdue} day(s) — ${v.customerName}${v.lat ? ` [${v.lat},${v.lng}]` : ''}`).join('\n')
    : 'None'

  const prompt = `You are a field service optimizer for a pool cleaning technician in Australia.

Current time: ${currentTime}
Technician location: ${currentLat && currentLng ? `${currentLat}, ${currentLng}` : 'unknown'}

Today's visits:
${visitLines || 'None scheduled'}

Backlog (overdue visits):
${backlogLines}

Based on the current situation, suggest the single best next action for the technician.
Consider: current time, visit statuses, proximity to technician location, and overdue backlog urgency.
If there are overdue visits nearby, consider suggesting them if it makes sense geographically.

Respond ONLY with a valid JSON object, no markdown, no backticks:
{"suggestion":"specific action","reason":"brief explanation 1-2 sentences","visitId":"visit id or null","address":"address or null","lat":number or null,"lng":number or null}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  const text = data.content?.[0]?.text ?? '{}'

  try {
    const clean = text.replace(/```json\n?|\n?```/g, '').trim()
    const result = JSON.parse(clean)
    return json(result)
  } catch {
    return json({ suggestion: 'Continue with your next scheduled visit.', reason: '', visitId: null, address: null, lat: null, lng: null })
  }
}
