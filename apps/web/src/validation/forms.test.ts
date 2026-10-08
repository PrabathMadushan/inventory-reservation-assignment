import { describe, expect, it } from 'vitest'
import { createOrderFormOptions, createOrderSchema, loginFormOptions, loginSchema } from './forms'

describe('Central assignment form validation', () => {
  it('accepts seeded login credentials and preserves password characters', () => {
    const input = { email: 'alice@example.test', password: ' DemoPass123! ' }
    expect(loginSchema.parse(input)).toEqual(input)
  })

  it.each([
    { email: 'invalid', password: 'DemoPass123!' },
    { email: 'alice@example.test', password: '' },
    { email: 'alice@example.test', password: 'DemoPass123!', role: 'OPERATIONS' },
  ])('rejects invalid or unsupported login input %j', input => {
    expect(loginSchema.safeParse(input).success).toBe(false)
  })

  it.each([0, -1, 1.5, '1', true, null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects quantity %s without coercion', quantity => {
    expect(createOrderSchema.safeParse({ productId: 'product-headphones', quantity }).success).toBe(false)
  })

  it('accepts positive safe integer quantities and rejects caller-supplied prices', () => {
    expect(createOrderSchema.parse({ productId: 'product-headphones', quantity: 1 })).toEqual({ productId: 'product-headphones', quantity: 1 })
    expect(createOrderSchema.safeParse({ productId: 'product-headphones', quantity: Number.MAX_SAFE_INTEGER }).success).toBe(true)
    expect(createOrderSchema.safeParse({ productId: 'product-headphones', quantity: 1, unitPriceMinor: 1 }).success).toBe(false)
    expect(createOrderSchema.safeParse({ productId: ' ', quantity: 1 }).success).toBe(false)
  })

  it('maps centralized login validation into React Hook Form field errors', async () => {
    const result = await loginFormOptions.resolver({ email: 'invalid', password: '' }, undefined, { fields: {}, shouldUseNativeValidation: false })
    expect(result.errors.email?.message).toBe('Enter a valid email address.')
    expect(result.errors.password?.message).toBe('Enter your password.')
  })

  it('passes valid order values through its React Hook Form resolver', async () => {
    const input = { productId: 'product-headphones', quantity: 1 }
    const result = await createOrderFormOptions.resolver(input, undefined, { fields: {}, shouldUseNativeValidation: false })
    expect(result).toEqual({ values: input, errors: {} })
  })
})
