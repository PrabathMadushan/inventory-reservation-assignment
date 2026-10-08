import { useEffect } from 'react'
import { ApiError } from '../../api/client'
import { useAuth } from './auth-context'

export function useSessionError(error: unknown) {
  const { signOut } = useAuth()
  const unauthorized = error instanceof ApiError && error.status === 401
  useEffect(() => {
    if (unauthorized) signOut()
  }, [unauthorized, signOut])
}
