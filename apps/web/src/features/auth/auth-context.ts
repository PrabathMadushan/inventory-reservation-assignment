import { createContext, useContext } from 'react'
import type { Session } from '../../validation/api'

export type AuthState = {
  session: Session | null
  signIn: (session: Session) => void
  signOut: () => void
}
export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth requires AuthProvider.')
  return auth
}
