// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  act,
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
const product = {
  id: 'product-keyboard',
  name: 'Mechanical Keyboard',
  unitPriceMinor: 1500000,
  currency: 'LKR',
  availableQuantity: 20,
}
const order: Order = {
  id: 'order-1',
  customerId: 'user-alice',
  productId: product.id,
  productName: product.name,
  quantity: 2,
  unitPriceMinor: 1500000,
  totalMinor: 3000000,
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

function renderApp() {
  const client = createQueryClient()
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  )
}
async function login() {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'alice@example.test' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'DemoPass123!' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('button', { name: 'Reserve Mechanical Keyboard' })
}
function mockApi(
  create: (options: RequestInit) => Promise<Response>,
  options: {
    cancel?: (options: RequestInit) => Promise<Response>
    read?: () => typeof order
  } = {},
) {
  const mock = vi.fn((url: string, requestOptions: RequestInit) => {
    if (url.endsWith('/auth/login'))
      return Promise.resolve(
        Response.json({
          accessToken: 'alice-token',
          user: {
            id: 'user-alice',
            email: 'alice@example.test',
            role: 'CUSTOMER',
          },
        }),
      )
    if (url.endsWith('/products'))
      return Promise.resolve(Response.json({ items: [product] }))
    if (url.endsWith('/orders') && requestOptions.method === 'POST')
      return create(requestOptions)
    if (url.endsWith('/orders/order-1/cancel') && options.cancel)
      return options.cancel(requestOptions)
    if (url.endsWith('/orders/order-1'))
      return Promise.resolve(Response.json(options.read?.() ?? order))
    if (url.includes('/orders?')) {
      const query = new URL(url).searchParams
      return Promise.resolve(
        Response.json({
          items: [options.read?.() ?? order],
          page: Number(query.get('page')),
          pageSize: 10,
          total: query.get('status') ? 1 : 11,
        }),
      )
    }
    throw new Error(`Unexpected request ${url}`)
  })
  vi.stubGlobal('fetch', mock)
  return mock
}
function reserve(quantity = '2') {
  fireEvent.click(
    screen.getByRole('button', { name: 'Reserve Mechanical Keyboard' }),
  )
  fireEvent.change(screen.getByLabelText('Quantity'), {
    target: { value: quantity },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create pending order' }))
}

describe('Customer reservation workflow', () => {
  it('keeps private order caches cleared when cancellation completes after logout', async () => {
    let finish!: (response: Response) => void
    const response = new Promise<Response>((resolve) => {
      finish = resolve
    })
    const cancel = vi.fn(() => response)
    mockApi(async () => Response.json(order, { status: 201 }), { cancel })
    renderApp()
    await login()
    reserve()
    await screen.findByText('ORDER_CREATED')
    const client = clients[clients.length - 1]
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel pending order' }),
    )
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Sign in to continue' })
    await act(async () => {
      finish(Response.json({ ...order, status: 'CANCELLED' }))
      await response
    })
    await waitFor(() =>
      expect(
        client.getQueryData(['orders', 'user-alice', 'detail', 'order-1']),
      ).toBeUndefined(),
    )
    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })
  it('cancels a pending order, refreshes state/history, and removes the terminal action', async () => {
    let current = order
    const cancel = vi.fn(async (input: RequestInit) => {
      expect(JSON.parse(input.body as string)).toEqual({})
      expect(new Headers(input.headers).get('Authorization')).toBe(
        'Bearer alice-token',
      )
      current = {
        ...order,
        status: 'CANCELLED',
        history: [
          ...order.history,
          {
            fromStatus: 'PENDING',
            toStatus: 'CANCELLED',
            reason: 'CUSTOMER_CANCELLED',
            occurredAt: order.updatedAt,
          },
        ],
      }
      return Response.json(current)
    })
    mockApi(async () => Response.json(order, { status: 201 }), {
      cancel,
      read: () => current,
    })
    renderApp()
    await login()
    reserve()
    await screen.findByText('ORDER_CREATED')
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel pending order' }),
    )
    await screen.findByText(
      'Order cancelled. Reserved stock has been returned.',
    )
    expect(await screen.findByText('CUSTOMER_CANCELLED')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Cancel pending order' }),
    ).toBeNull()
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it.each(['stale-conflict', 'lost-response'] as const)(
    'refreshes the current terminal status after %s without another cancellation',
    async (scenario) => {
      let current = order
      const cancel = vi.fn(async () => {
        current = {
          ...order,
          status: scenario === 'stale-conflict' ? 'CONFIRMED' : 'CANCELLED',
          history: [
            ...order.history,
            {
              fromStatus: 'PENDING',
              toStatus:
                scenario === 'stale-conflict' ? 'CONFIRMED' : 'CANCELLED',
              reason:
                scenario === 'stale-conflict'
                  ? 'PAYMENT_SUCCEEDED'
                  : 'CUSTOMER_CANCELLED',
              occurredAt: order.updatedAt,
            },
          ],
        }
        if (scenario === 'lost-response')
          throw new TypeError('Lost committed response')
        return Response.json(
          {
            code: 'INVALID_TRANSITION',
            message: 'Only a pending order can be cancelled.',
          },
          { status: 409 },
        )
      })
      mockApi(async () => Response.json(order, { status: 201 }), {
        cancel,
        read: () => current,
      })
      renderApp()
      await login()
      reserve()
      await screen.findByText('ORDER_CREATED')
      fireEvent.click(
        screen.getByRole('button', { name: 'Cancel pending order' }),
      )
      await screen.findByText(
        scenario === 'stale-conflict'
          ? 'Only a pending order can be cancelled.'
          : 'The cancellation result is uncertain. Refresh the order before retrying.',
      )
      expect(
        await screen.findByText(
          scenario === 'stale-conflict'
            ? 'PAYMENT_SUCCEEDED'
            : 'CUSTOMER_CANCELLED',
        ),
      ).toBeTruthy()
      expect(
        screen.queryByRole('button', { name: 'Cancel pending order' }),
      ).toBeNull()
      expect(cancel).toHaveBeenCalledTimes(1)
    },
  )

  it('returns an expired cancellation session to login', async () => {
    const cancel = vi.fn(async () =>
      Response.json(
        { code: 'UNAUTHORIZED', message: 'Invalid token.' },
        { status: 401 },
      ),
    )
    mockApi(async () => Response.json(order, { status: 201 }), { cancel })
    renderApp()
    await login()
    reserve()
    await screen.findByText('ORDER_CREATED')
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel pending order' }),
    )
    await screen.findByRole('heading', { name: 'Sign in to continue' })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('ORDER_CREATED')).toBeNull()
  })

  it('validates quantity, sends only canonical input with a retry key, then shows history and filtering', async () => {
    const create = vi
      .fn()
      .mockResolvedValue(Response.json(order, { status: 201 }))
    const fetch = mockApi(create)
    renderApp()
    await login()
    reserve('0')
    expect(await screen.findByText('Quantity must be at least 1.')).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Quantity'), {
      target: { value: '2' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Create pending order' }),
    )
    expect(await screen.findByText('Order request completed.')).toBeTruthy()
    expect(await screen.findByText('ORDER_CREATED')).toBeTruthy()
    const options = create.mock.calls[0][0] as RequestInit
    expect(JSON.parse(options.body as string)).toEqual({
      productId: product.id,
      quantity: 2,
    })
    expect(new Headers(options.headers).get('Idempotency-Key')).toMatch(
      /^[0-9a-f-]{36}$/,
    )
    expect(new Headers(options.headers).get('Authorization')).toBe(
      'Bearer alice-token',
    )
    expect(sessionStorage.getItem('reservation-intent:user-alice')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to my orders' }))
    await screen.findByRole('button', { name: /^View order / })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() =>
      expect(fetch.mock.calls.some(([url]) => url.includes('page=2'))).toBe(
        true,
      ),
    )
    await screen.findByText(/Page 2 of 2/)
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'PENDING' },
    })
    await screen.findByText(/Page 1 of 1/)
    expect(
      fetch.mock.calls.some(
        ([url]) => url.includes('page=1') && url.includes('status=PENDING'),
      ),
    ).toBe(true)
  })

  it('preserves the same key/input after an uncertain response and a reload, without automatic retries', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Lost response after server commit'))
      .mockResolvedValueOnce(Response.json(order, { status: 200 }))
    mockApi(create)
    const view = renderApp()
    await login()
    reserve()
    await screen.findByText(
      'The result is uncertain. Retry the same reservation to confirm it.',
    )
    expect(create).toHaveBeenCalledTimes(1)
    const saved = sessionStorage.getItem('reservation-intent:user-alice')!
    expect(JSON.parse(saved)).toMatchObject({
      input: { productId: product.id, quantity: 2 },
    })
    expect(saved).not.toMatch(/token|password|email/i)
    expect(
      (screen.getByLabelText('Quantity') as HTMLInputElement).readOnly,
    ).toBe(true)
    view.unmount()
    clients.forEach((client) => client.clear())
    renderApp()
    await login()
    await screen.findByRole('button', { name: 'Retry same reservation' })
    expect(
      screen.getByRole('heading', { name: 'Reserve Mechanical Keyboard' }),
    ).toBeTruthy()
    expect(create).toHaveBeenCalledTimes(1)
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry same reservation' }),
    )
    await screen.findByText('ORDER_CREATED')
    expect(create).toHaveBeenCalledTimes(2)
    const first = create.mock.calls[0][0] as RequestInit
    const second = create.mock.calls[1][0] as RequestInit
    expect(second.body).toBe(first.body)
    expect(new Headers(second.headers).get('Idempotency-Key')).toBe(
      new Headers(first.headers).get('Idempotency-Key'),
    )
    expect(sessionStorage.getItem('reservation-intent:user-alice')).toBeNull()
  })

  it('allows corrected input with a fresh key after a definitive stock rejection', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            code: 'INSUFFICIENT_STOCK',
            message: 'Not enough stock is available for this quantity.',
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { ...order, quantity: 1, totalMinor: 1500000 },
          { status: 201 },
        ),
      )
    mockApi(create)
    renderApp()
    await login()
    reserve('21')
    await screen.findByText('Not enough stock is available for this quantity.')
    expect(
      (screen.getByLabelText('Quantity') as HTMLInputElement).readOnly,
    ).toBe(false)
    expect(sessionStorage.getItem('reservation-intent:user-alice')).toBeNull()
    fireEvent.change(screen.getByLabelText('Quantity'), {
      target: { value: '1' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Create pending order' }),
    )
    await screen.findByText('ORDER_CREATED')
    const first = create.mock.calls[0][0] as RequestInit
    const second = create.mock.calls[1][0] as RequestInit
    expect(new Headers(second.headers).get('Idempotency-Key')).not.toBe(
      new Headers(first.headers).get('Idempotency-Key'),
    )
    expect(JSON.parse(second.body as string)).toEqual({
      productId: product.id,
      quantity: 1,
    })
  })
})
