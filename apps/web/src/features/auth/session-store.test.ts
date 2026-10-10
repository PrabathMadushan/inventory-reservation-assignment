// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { readStoredSession, writeStoredSession } from './session-store'

const session = {
  accessToken: 'alice-token',
  user: {
    id: 'user-alice',
    email: 'alice@example.test',
    role: 'CUSTOMER' as const,
  },
}

afterEach(() => {
  sessionStorage.clear()
})

describe('session storage', () => {
  it('restores a valid session and drops anything else', () => {
    writeStoredSession(session)
    expect(readStoredSession()).toEqual(session)
    sessionStorage.setItem('inventory.session', '{"accessToken":1}')
    expect(readStoredSession()).toBeNull()
    expect(sessionStorage.getItem('inventory.session')).toBeNull()
  })
})
