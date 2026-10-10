import { loginResponseSchema } from '../../validation/api'
import type { Session } from '../../validation/api'

export const sessionStorageKey = 'inventory.session'

export function readStoredSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(sessionStorageKey)
    if (!raw) return null
    const parsed = loginResponseSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      sessionStorage.removeItem(sessionStorageKey)
      return null
    }
    return parsed.data
  } catch {
    sessionStorage.removeItem(sessionStorageKey)
    return null
  }
}

export function writeStoredSession(session: Session | null) {
  if (!session) {
    sessionStorage.removeItem(sessionStorageKey)
    return
  }
  sessionStorage.setItem(sessionStorageKey, JSON.stringify(session))
}
