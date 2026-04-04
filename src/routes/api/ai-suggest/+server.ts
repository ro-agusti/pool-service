import { json } from '@sveltejs/kit'
import { ANTHROPIC_API_KEY } from '$env/static/private'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
  const { waterTest, poolVolume, poolType } = await request.json()

  const params = [
    waterTest.ph            != null ? `pH: ${waterTest.ph} (ideal 7.2–7.6)` : null,
    waterTest.chlorine      != null ? `Free chlorine: ${waterTest.chlorine} ppm (ideal 1–3)` : null,
    waterTest.alkalinity    != null ? `Alkalinity: ${waterTest.alkalinity} ppm (ideal 80–120)` : null,
    waterTest.stabiliser    != null ? `Stabiliser (CYA): ${waterTest.stabiliser} ppm (ideal 30–50)` : null,
    waterTest.salt          != null ? `Salt: ${waterTest.salt} ppm (ideal 3000–4500)` : null,
    waterTest.calcium_hardness != null ? `Calcium hardness: ${waterTest.calcium_hardness} ppm (ideal 200–400)` : null,
  ].filter(Boolean).join('\n')

  if (!params) {
    return json({ error: 'No water test values provided' }, { status: 400 })
  }

  const prompt = `You are an expert pool water chemist in Australia. Based on the water test results below, provide specific chemical treatment recommendations.

Pool details:
- Volume: ${poolVolume ? `${poolVolume.toLocaleString()} litres` : 'unknown'}
- Type: ${poolType ?? 'unknown'}

Water test results:
${params}

Respond ONLY with a JSON array of recommendations. Each item must have:
- "parameter": the water parameter (e.g. "pH", "Chlorine")
- "status": "ok", "low", or "high"  
- "action": specific action to take (e.g. "Add 500g of pH Up")
- "product": suggested product name
- "amount": amount to add (e.g. "500g", "2L")
- "note": brief explanation (1 sentence max)

Only include parameters that need action (not "ok" ones). If all parameters are within range, return an empty array [].
Respond with JSON only, no markdown, no explanation.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  const text = data.content?.[0]?.text ?? '[]'

  try {
    const recommendations = JSON.parse(text)
    return json({ recommendations })
  } catch {
    return json({ recommendations: [] })
  }
}