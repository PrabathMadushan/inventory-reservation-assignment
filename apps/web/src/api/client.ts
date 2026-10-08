import { apiErrorSchema, connectionSchema } from '../validation/api'
import type { Connection } from '../validation/api'
import type { z } from 'zod'

const baseUrl = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
).replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type ApiRequest = {
  method?: 'GET' | 'POST'
  body?: unknown
  token?: string
  signal?: AbortSignal
  idempotencyKey?: string
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  { method = 'GET', body, token, signal, idempotencyKey }: ApiRequest = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    signal,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  // Proxies/network failures may return HTML instead of the API error contract.
  const result: unknown = await response.json().catch((error: unknown) => {
    if (signal?.aborted) throw error
    return null
  })
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(result)
    throw new ApiError(
      response.status,
      error.success ? error.data.code : 'HTTP_ERROR',
      error.success
        ? error.data.message
        : 'Unable to connect to the application.',
    )
  }
  const parsed = schema.safeParse(result)
  if (!parsed.success)
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The application returned an unexpected response.',
    )
  return parsed.data
}

export function checkConnection(signal?: AbortSignal): Promise<Connection> {
  return apiRequest('', connectionSchema, { signal })
}
