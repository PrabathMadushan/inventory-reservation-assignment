// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import App from '../../App'
import { createQueryClient } from '../../api/query-client'

const clients: QueryClient[] = []
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.unstubAllGlobals()
})

function renderApplication() {
  const client = createQueryClient()
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  )
  return client
}

function fillLogin(email = 'alice@example.test') {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: email },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'DemoPass123!' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('Shared login and account flow', () => {
  it('uses centralized field validation before making a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderApplication()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy()
    expect(screen.getByText('Enter your password.')).toBeTruthy()
    expect(
      screen.getByLabelText('Email address').getAttribute('aria-invalid'),
    ).toBe('true')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows incorrect-credential feedback and preserves editable input', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { code: 'UNAUTHORIZED', message: 'Invalid email or password.' },
            { status: 401 },
          ),
        ),
    )
    renderApplication()
    fillLogin()
    expect(await screen.findByText('Invalid email or password.')).toBeTruthy()
    expect(
      (screen.getByLabelText('Email address') as HTMLInputElement).value,
    ).toBe('alice@example.test')
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe(
      'DemoPass123!',
    )
  })

  it('uses bearer requests, clears private caches on logout, and separates account roles', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, options: RequestInit) => {
        if (url.endsWith('/auth/login')) {
          const input = JSON.parse(options.body as string) as { email: string }
          const operations = input.email === 'ops@example.test'
          return Promise.resolve(
            Response.json({
              accessToken: operations ? 'ops-token' : 'alice-token',
              user: {
                id: operations ? 'user-ops' : 'user-alice',
                email: input.email,
                role: operations ? 'OPERATIONS' : 'CUSTOMER',
              },
            }),
          )
        }
        return Promise.resolve(
          Response.json({
            items: [
              {
                id: 'product-keyboard',
                name: 'Mechanical Keyboard',
                unitPriceMinor: 1500000,
                currency: 'LKR',
                availableQuantity: 20,
              },
            ],
          }),
        )
      })
    vi.stubGlobal('fetch', fetchMock)
    const client = renderApplication()
    fillLogin()
    expect(await screen.findByText('Mechanical Keyboard')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'My orders' })).toBeTruthy()
    expect(screen.getByText('15,000.00')).toBeTruthy()
    const productCall = fetchMock.mock.calls.find(([url]) =>
      (url as string).endsWith('/products'),
    )!
    expect((productCall[1] as RequestInit).headers).toEqual({
      Authorization: 'Bearer alice-token',
    })
    expect(client.getQueryData(['products', 'user-alice'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('button', { name: 'Sign in' })
    expect(client.getQueryData(['products', 'user-alice'])).toBeUndefined()
    expect(client.getMutationCache().getAll()).toHaveLength(0)
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe(
      '',
    )
    fillLogin('ops@example.test')
    await screen.findByRole('button', { name: 'Operations orders' })
    expect(screen.queryByRole('button', { name: 'My orders' })).toBeNull()
    await waitFor(() =>
      expect(client.getQueryData(['products', 'user-ops'])).toBeTruthy(),
    )
    expect(client.getQueryData(['products', 'user-alice'])).toBeUndefined()
  })

  it('returns an expired/invalid product session to the sign-in screen', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith('/auth/login')
            ? Response.json({
                accessToken: 'expired-token',
                user: {
                  id: 'user-alice',
                  email: 'alice@example.test',
                  role: 'CUSTOMER',
                },
              })
            : Response.json(
                { code: 'UNAUTHORIZED', message: 'Unauthorized.' },
                { status: 401 },
              ),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const client = renderApplication()
    fillLogin()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
    })
    expect(client.getQueryData(['products', 'user-alice'])).toBeUndefined()
  })
})
