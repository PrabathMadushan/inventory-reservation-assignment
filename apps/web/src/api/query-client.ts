import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
          return failureCount < 1
        },
      },
      // Retrying a mutation must be a deliberate workflow decision.
      mutations: { retry: false },
    },
  })
}

export const queryClient = createQueryClient()
