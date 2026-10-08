import { z } from 'zod'

export const connectionSchema = z.strictObject({
  status: z.literal('ok'),
  database: z.literal('connected'),
})

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
})

export type Connection = z.infer<typeof connectionSchema>

export const userSchema = z.strictObject({
  id: z.string().min(1),
  email: z.email(),
  role: z.enum(['CUSTOMER', 'OPERATIONS']),
})
export const loginResponseSchema = z.strictObject({
  accessToken: z.string().min(1),
  user: userSchema,
})
export const productSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  unitPriceMinor: z.int().nonnegative(),
  currency: z.literal('LKR'),
  availableQuantity: z.int().nonnegative(),
})
export const productsResponseSchema = z.strictObject({
  items: z.array(productSchema),
})
export type Session = z.infer<typeof loginResponseSchema>
export type Product = z.infer<typeof productSchema>

export const orderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'FAILED',
  'CANCELLED',
])
export const orderSchema = z.strictObject({
  id: z.string().min(1),
  customerId: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.int().positive(),
  unitPriceMinor: z.int().nonnegative(),
  totalMinor: z.int().nonnegative(),
  currency: z.literal('LKR'),
  status: orderStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  history: z.array(
    z.strictObject({
      fromStatus: orderStatusSchema.nullable(),
      toStatus: orderStatusSchema,
      reason: z.enum([
        'ORDER_CREATED',
        'PAYMENT_SUCCEEDED',
        'PAYMENT_FAILED',
        'CUSTOMER_CANCELLED',
      ]),
      occurredAt: z.iso.datetime(),
    }),
  ),
})
export const orderPageSchema = z.strictObject({
  items: z.array(orderSchema),
  page: z.int().positive(),
  pageSize: z.int().positive().max(100),
  total: z.int().nonnegative(),
})
export type Order = z.infer<typeof orderSchema>
export type OrderStatus = z.infer<typeof orderStatusSchema>
