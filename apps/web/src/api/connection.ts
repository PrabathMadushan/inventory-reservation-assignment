import { queryOptions, useQuery } from '@tanstack/react-query'
import { checkConnection } from './client'

export const connectionQueryOptions = queryOptions({
  queryKey: ['connection'],
  queryFn: ({ signal }) => checkConnection(signal),
})

export function useConnection() {
  return useQuery(connectionQueryOptions)
}
