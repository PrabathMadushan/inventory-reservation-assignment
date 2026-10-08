import { useQuery } from '@tanstack/react-query'
import { apiRequest } from './client'
import { productsResponseSchema } from '../validation/api'
import { useAuth } from '../features/auth/auth-context'

export function useProducts({ enabled = true }: { enabled?: boolean } = {}) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['products', session?.user.id],
    enabled: !!session && enabled,
    queryFn: ({ signal }) =>
      apiRequest('/products', productsResponseSchema, {
        token: session?.accessToken,
        signal,
      }),
  })
}
