import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, checkConnection } from './client'
import { connectionQueryOptions } from './connection'
import { createQueryClient } from './query-client'

afterEach(() => vi.unstubAllGlobals())

describe('Connection API and query management', () => {
  it('returns validated connection data and forwards cancellation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ status: 'ok', database: 'connected' }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    expect(await checkConnection(controller.signal)).toEqual({
      status: 'ok',
      database: 'connected',
    })
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), {
      method: 'GET',
      headers: {},
      signal: controller.signal,
    })
  })

  it('preserves the API error contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { code: 'UNAUTHORIZED', message: 'Unauthorized' },
            { status: 401 },
          ),
        ),
    )
    await expect(checkConnection()).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    })
  })

  it('handles non-JSON failure responses without exposing their content', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('<html>private proxy error</html>', { status: 502 }),
        ),
    )
    await expect(checkConnection()).rejects.toMatchObject({
      status: 502,
      code: 'HTTP_ERROR',
      message: 'Unable to connect to the application.',
    })
  })

  it('rejects malformed success data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ status: 'ok' })),
    )
    await expect(checkConnection()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })

  it('retains aborted requests as cancellation rather than an API error', async () => {
    const aborted = new DOMException('Aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted))
    await expect(checkConnection()).rejects.toBe(aborted)
  })

  it('preserves cancellation while reading the response body', async () => {
    const controller = new AbortController()
    const aborted = new DOMException('Aborted', 'AbortError')
    const response = Response.json({ status: 'ok', database: 'connected' })
    vi.spyOn(response, 'json').mockImplementation(() => {
      controller.abort()
      return Promise.reject(aborted)
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    await expect(checkConnection(controller.signal)).rejects.toBe(aborted)
  })

  it('stores validated data under the connection query key', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ status: 'ok', database: 'connected' }),
        ),
    )
    const client = createQueryClient()
    try {
      await client.fetchQuery(connectionQueryOptions)
      expect(client.getQueryData(['connection'])).toEqual({
        status: 'ok',
        database: 'connected',
      })
    } finally {
      client.clear()
    }
  })

  it('does not retry unauthorized reads or automatically replay mutations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { code: 'UNAUTHORIZED', message: 'Unauthorized' },
          { status: 401 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const client = createQueryClient()
    try {
      await expect(
        client.fetchQuery(connectionQueryOptions),
      ).rejects.toBeInstanceOf(ApiError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const mutation = vi
        .fn()
        .mockRejectedValue(new Error('Uncertain response'))
      await expect(
        client
          .getMutationCache()
          .build(client, { mutationFn: mutation })
          .execute(undefined),
      ).rejects.toThrow('Uncertain response')
      expect(mutation).toHaveBeenCalledTimes(1)
    } finally {
      client.clear()
    }
  })
})
