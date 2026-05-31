import { openDB } from 'idb'

const DB = 'clearwave-offline'
const STORE = 'sync-queue'

export interface QueuedAction {
  id: string
  type: 'save_checklist'
  payload: Record<string, unknown>
  createdAt: number
  retries: number
}

async function db() {
  return openDB(DB, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' })
    }
  })
}

export async function enqueue(payload: Record<string, unknown>) {
  const d = await db()
  await d.put(STORE, { id: crypto.randomUUID(), type: 'save_checklist', payload, createdAt: Date.now(), retries: 0 })
}

export async function getQueue(): Promise<QueuedAction[]> {
  return (await db()).getAll(STORE)
}

export async function dequeue(id: string) {
  return (await db()).delete(STORE, id)
}

export async function incrementRetry(id: string) {
  const d = await db()
  const item = await d.get(STORE, id)
  if (item) await d.put(STORE, { ...item, retries: item.retries + 1 })
}