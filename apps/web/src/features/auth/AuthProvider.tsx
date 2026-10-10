import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '../../validation/api'
import { AuthContext } from './auth-context'
import { readStoredSession, writeStoredSession } from './session-store'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readStoredSession)
  const client = useQueryClient()
  const signIn = useCallback(
    (next: Session) => {
      client.clear()
      writeStoredSession(next)
      setSession(next)
    },
    [client],
  )
  const signOut = useCallback(() => {
    // Clears cached queries/mutations and cancels active query requests.
    client.clear()
    writeStoredSession(null)
    setSession(null)
  }, [client])
  return (
    <AuthContext.Provider value={{ session, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
