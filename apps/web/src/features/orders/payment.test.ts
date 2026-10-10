// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { beginPayment, readPaymentReturn } from './payment'

describe('payment return', () => {
  it('accepts only success or failure with a bounded order id', () => {
    expect(readPaymentReturn('?payment=success&orderId=order-1')).toEqual({
      payment: 'success',
      orderId: 'order-1',
    })
    expect(readPaymentReturn('?payment=failure&orderId=order-1')?.payment).toBe(
      'failure',
    )
    expect(readPaymentReturn('?payment=paid&orderId=order-1')).toBeNull()
    expect(readPaymentReturn('?payment=success&orderId=../admin')).toBeNull()
  })

  it('opens checkout with the ticket and keeps the token out of the URL', async () => {
    const ticket = 'a'.repeat(64)
    const calls: Array<[string, RequestInit]> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push([String(input), init ?? {}])
      return Response.json({ ticket })
    }
    const navigate = vi.fn()
    await beginPayment({
      gateway: 'http://127.0.0.1:4001/',
      token: 'alice-token',
      orderId: 'order-1',
      origin: 'http://localhost:5173',
      fetchImpl,
      navigate,
    })
    const [url, options] = calls[0]
    expect(url).toBe('http://127.0.0.1:4001/start')
    expect(new Headers(options.headers).get('Authorization')).toBe(
      'Bearer alice-token',
    )
    expect(JSON.parse(options.body as string)).toEqual({
      orderId: 'order-1',
      returnOrigin: 'http://localhost:5173',
    })
    expect(navigate).toHaveBeenCalledWith(
      `http://127.0.0.1:4001/checkout?ticket=${ticket}`,
    )
    expect(String(navigate.mock.calls[0][0])).not.toContain('alice-token')
  })
})
