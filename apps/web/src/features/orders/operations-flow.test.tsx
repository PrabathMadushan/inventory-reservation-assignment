// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import App from '../../App'
import { createQueryClient } from '../../api/query-client'
import type { Order } from '../../validation/api'

const clients: QueryClient[] = []
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  sessionStorage.clear()
  vi.unstubAllGlobals()
})
const order: Order = {
  id: 'order-bob',
  customerId: 'user-bob',
  productId: 'product-keyboard',
  productName: 'Mechanical Keyboard',
  quantity: 1,
  unitPriceMinor: 1500000,
  totalMinor: 1500000,
  currency: 'LKR',
  status: 'PENDING',
  createdAt: '2026-10-08T10:00:00.000Z',
  updatedAt: '2026-10-08T10:00:00.000Z',
  history: [
    {
      fromStatus: null,
      toStatus: 'PENDING',
      reason: 'ORDER_CREATED',
      occurredAt: '2026-10-08T10:00:00.000Z',
    },
  ],
}
function mount() {
  const client = createQueryClient()
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  )
  return client
}
async function login(email = 'ops@example.test') {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: email },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'DemoPass123!' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('button', {
    name: email === 'ops@example.test' ? 'Operations orders' : 'My orders',
  })
}
function mockApi(read: (url: URL) => Promise<Response>) {
  const fetch = vi.fn((url: string, options: RequestInit) => {
    if (url.endsWith('/auth/login')) {
      const input = JSON.parse(options.body as string) as { email: string }
      const ops = input.email === 'ops@example.test'
      return Promise.resolve(
        Response.json({
          accessToken: ops ? 'ops-token' : 'alice-token',
          user: {
            id: ops ? 'user-ops' : 'user-alice',
            email: input.email,
            role: ops ? 'OPERATIONS' : 'CUSTOMER',
          },
        }),
      )
    }
    expect(new Headers(options.headers).get('Authorization')).toMatch(
      /Bearer (ops|alice)-token/,
    )
    if (url.endsWith('/products'))
      return Promise.resolve(Response.json({ items: [] }))
    return read(new URL(url))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
function page(url: URL, items: Order[] = [order], total = 21) {
  return Response.json({
    items,
    total,
    page: Number(url.searchParams.get('page') ?? 1),
    pageSize: 10,
  })
}

describe('Operations order workspace', () => {
  it('uses operations APIs, preserves filter/page across detail/back, resets filter pages and hides customer mutations', async () => {
    const fetch = mockApi(async (url) =>
      url.pathname.endsWith('/order-bob')
        ? Response.json(order)
        : page(
            url,
            url.searchParams.get('status') === 'FAILED' ? [] : [order],
            url.searchParams.get('status') === 'FAILED' ? 0 : 21,
          ),
    )
    mount()
    await login()
    expect(screen.queryByRole('button', { name: 'My orders' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Operations orders' }))
    await screen.findByText('user-bob')
    expect(
      screen.getByRole('table', { name: 'All customer orders' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Reserve / })).toBeNull()
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'PENDING' },
    })
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([url]) => url.includes('status=PENDING')),
      ).toBe(true),
    )
    await screen.findByRole('button', { name: 'View order order-bob' })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText(/Page 2 of 3/)
    fireEvent.click(
      screen.getByRole('button', { name: 'View order order-bob' }),
    )
    await screen.findByText('ORDER_CREATED')
    expect(screen.getByText('user-bob')).toBeTruthy()
    expect(screen.getByText('product-keyboard')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Cancel pending order' }),
    ).toBeNull()
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Order details',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to operations orders' }),
    )
    await screen.findByRole('button', { name: 'View order order-bob' })
    expect(await screen.findByText(/Page 2 of 3/)).toBeTruthy()
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe(
      'PENDING',
    )
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Operations orders' }),
    )
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'FAILED' },
    })
    await screen.findByText('No orders match this filter.')
    await screen.findByText(/Page 1 of 1/)
    expect(
      fetch.mock.calls.some(
        ([url]) =>
          url.includes('/operations/orders?page=1') &&
          url.includes('status=FAILED'),
      ),
    ).toBe(true)
    expect(
      fetch.mock.calls
        .filter(([url]) => url.includes('/orders'))
        .every(([url]) => url.includes('/operations/orders')),
    ).toBe(true)
  })

  it('keeps a filter after a recoverable error and offers refresh, with full terminal history inspection', async () => {
    let fail = true
    const terminal: Order = {
      ...order,
      status: 'CONFIRMED',
      history: [
        ...order.history,
        {
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          reason: 'PAYMENT_SUCCEEDED',
          occurredAt: order.updatedAt,
        },
      ],
    }
    mockApi(async (url) => {
      if (url.pathname.endsWith('/order-bob')) return Response.json(terminal)
      if (url.searchParams.get('status') === 'CONFIRMED' && fail) {
        fail = false
        return Response.json(
          { code: 'FORBIDDEN', message: 'Unable to read this order page.' },
          { status: 403 },
        )
      }
      return page(url, [terminal], 1)
    })
    mount()
    await login()
    fireEvent.click(screen.getByRole('button', { name: 'Operations orders' }))
    await screen.findByRole('button', { name: 'View order order-bob' })
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'CONFIRMED' },
    })
    await screen.findByText('Unable to read this order page.')
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe(
      'CONFIRMED',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Refresh orders' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'View order order-bob' }),
    )
    await screen.findByText('PAYMENT_SUCCEEDED')
    expect(
      screen.queryByRole('button', { name: 'Cancel pending order' }),
    ).toBeNull()
  })

  it('clears operations caches on account change and uses only customer routes for the next customer', async () => {
    const fetch = mockApi(async (url) =>
      page(
        url,
        url.pathname.includes('/operations/') ? [order] : [],
        url.pathname.includes('/operations/') ? 1 : 0,
      ),
    )
    const client = mount()
    await login()
    fireEvent.click(screen.getByRole('button', { name: 'Operations orders' }))
    await screen.findByRole('button', { name: 'View order order-bob' })
    expect(
      client.getQueryCache().findAll({ queryKey: ['operations-orders'] })
        .length,
    ).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Sign in to continue' })
    expect(client.getQueryCache().getAll()).toHaveLength(0)
    await login('alice@example.test')
    expect(
      screen.queryByRole('button', { name: 'Operations orders' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'My orders' }))
    await screen.findByText('No orders match this filter.')
    expect(
      client.getQueryCache().findAll({ queryKey: ['operations-orders'] }),
    ).toHaveLength(0)
    expect(
      fetch.mock.calls.some(([url]) => url.includes('/api/orders?page=1')),
    ).toBe(true)
    expect(screen.queryByText('user-bob')).toBeNull()
  })

  it('returns an expired operations order session to login', async () => {
    mockApi(async () =>
      Response.json(
        { code: 'UNAUTHORIZED', message: 'Invalid token.' },
        { status: 401 },
      ),
    )
    const client = mount()
    await login()
    fireEvent.click(screen.getByRole('button', { name: 'Operations orders' }))
    await screen.findByRole('heading', { name: 'Sign in to continue' })
    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })
})
