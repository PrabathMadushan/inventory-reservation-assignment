import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from './client'
import { useAuth } from '../features/auth/auth-context'
import { orderPageSchema, orderSchema } from '../validation/api'
import { orderIntentSchema, orderListSchema } from '../validation/forms'
import type { OrderIntent, OrderListInput } from '../validation/forms'

export function useCreateOrder() {
  const { session } = useAuth()
  const client = useQueryClient()
  return useMutation({
    mutationKey: ['create-order', session?.user.id],
    retry: false,
    mutationFn: (attempt: OrderIntent) => {
      const intent = orderIntentSchema.parse(attempt)
      return apiRequest('/orders', orderSchema, {
        method: 'POST',
        token: session?.accessToken,
        idempotencyKey: intent.key,
        body: intent.input,
      })
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['products'] }),
        client.invalidateQueries({ queryKey: ['orders', session?.user.id] }),
      ]),
  })
}

export type OrderAudience = 'customer' | 'operations'
export function useOrders(
  input: OrderListInput,
  audience: OrderAudience = 'customer',
) {
  const { session } = useAuth()
  const parameters = orderListSchema.parse(input)
  const query = new URLSearchParams({
    page: String(parameters.page),
    pageSize: String(parameters.pageSize),
    ...(parameters.status ? { status: parameters.status } : {}),
  })
  return useQuery({
    queryKey: [
      audience === 'operations' ? 'operations-orders' : 'orders',
      session?.user.id,
      'list',
      parameters,
    ],
    enabled:
      !!session &&
      session.user.role ===
        (audience === 'operations' ? 'OPERATIONS' : 'CUSTOMER'),
    queryFn: ({ signal }) =>
      apiRequest(
        `${audience === 'operations' ? '/operations' : ''}/orders?${query}`,
        orderPageSchema,
        {
          token: session?.accessToken,
          signal,
        },
      ),
  })
}

export function useCancelOrder(id: string) {
  const { session } = useAuth()
  const client = useQueryClient()
  return useMutation({
    mutationKey: ['cancel-order', session?.user.id, id],
    retry: false,
    mutationFn: () =>
      apiRequest(`/orders/${encodeURIComponent(id)}/cancel`, orderSchema, {
        method: 'POST',
        body: {},
        token: session?.accessToken,
      }),
    onSuccess: (order) => {
      // Logout clears this query. A delayed mutation must not recreate it.
      if (!client.getQueryState(['orders', session?.user.id, 'detail', id]))
        return
      client.setQueryData(['orders', session?.user.id, 'detail', id], order)
      return Promise.all([
        client.invalidateQueries({ queryKey: ['products'] }),
        client.invalidateQueries({ queryKey: ['orders', session?.user.id] }),
      ])
    },
  })
}

export function useOrder(id: string, audience: OrderAudience = 'customer') {
  const { session } = useAuth()
  return useQuery({
    queryKey: [
      audience === 'operations' ? 'operations-orders' : 'orders',
      session?.user.id,
      'detail',
      id,
    ],
    enabled:
      !!session &&
      session.user.role ===
        (audience === 'operations' ? 'OPERATIONS' : 'CUSTOMER'),
    queryFn: ({ signal }) =>
      apiRequest(
        `${audience === 'operations' ? '/operations' : ''}/orders/${encodeURIComponent(id)}`,
        orderSchema,
        {
          token: session?.accessToken,
          signal,
        },
      ),
  })
}
