import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ANTHROPIC_API_KEY } from '$env/static/private'

export const POST: RequestHandler = async ({ request }) => {
  const { properties, technicians } = await request.json()

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const prompt = `You are an expert field service route optimizer for a pool cleaning company in Australia.

Your task: assign each property to the most suitable technician, optimizing for:
1. Geographic clustering — technicians should have nearby properties to minimize travel
2. Workload balance — distribute properties equitably across technicians
3. Schedule compatibility — group properties with the same preferred day together per technician

Technicians:
${technicians.map((t: any) => `- ${t.name} (id: ${t.id})`).join('\n')}

Properties to assign:
${properties.map((p: any) => `- id: ${p.id} | ${p.customers?.name ?? p.address} | ${p.suburb ?? ''} | lat: ${p.lat}, lng: ${p.lng} | current tech: ${p.currentTechName ?? 'unassigned'} | ${p.recurrence ?? 'no plan'} | preferred day: ${p.preferredDay !== null && p.preferredDay !== undefined ? dayNames[p.preferredDay] : 'any'}`).join('\n')}

Rules:
- Every property with a plan must be assigned to exactly one technician
- Aim for geographic zones — each technician covers a contiguous area
- Balance workload: similar number of properties per technician (±2 is acceptable)
- Weekly visits count more toward workload than fortnightly or monthly
- Only suggest changes where there's a clear benefit — don't change for the sake of changing

Respond ONLY with a JSON array, no markdown, no explanation:
[
  {
    "propertyId": "uuid",
    "currentTechId": "uuid or null",
    "suggestedTechId": "uuid",
    "planId": "uuid or null",
    "reason": "brief reason (max 10 words)"
  }
]

Include ALL properties in the response, even those that don't change.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  const text = data.content?.[0]?.text ?? '[]'

  try {
    const clean = text.replace(/```json\n?|\n?```/g, '').trim()
    const recommendations = JSON.parse(clean)
    return json({ recommendations })
  } catch {
    return json({ recommendations: [] })
  }
}