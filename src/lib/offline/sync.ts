import { getQueue, dequeue, incrementRetry } from './queue'

export async function syncQueue() {
  if (!navigator.onLine) return { synced: 0, failed: 0 }

  const queue = await getQueue()
  let synced = 0
  let failed = 0

  for (const action of queue) {
    if (action.retries >= 3) {
      // Descartar después de 3 intentos
      await dequeue(action.id)
      continue
    }

    try {
      let endpoint = ''
      if (action.type === 'update_checklist') endpoint = '/api/offline/sync-checklist'
      if (action.type === 'update_visit_status') endpoint = '/api/offline/sync-visit-status'

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.payload)
      })

      if (res.ok) {
        await dequeue(action.id)
        synced++
      } else {
        await incrementRetry(action.id)
        failed++
      }
    } catch {
      await incrementRetry(action.id)
      failed++
    }
  }

  return { synced, failed }
}