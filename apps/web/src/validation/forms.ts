import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UseFormProps } from 'react-hook-form'
import { orderStatusSchema } from './api'

// Keep form rules here; the API still validates every submitted request.
export const loginSchema = z.strictObject({
  email: z.email({ error: 'Enter a valid email address.' }),
  password: z.string().min(1, 'Enter your password.'),
})

export const createOrderSchema = z.strictObject({
  productId: z
    .string()
    .refine((value) => value.trim().length > 0, 'Choose a product.'),
  // Register numeric inputs with valueAsNumber; do not coerce strings/booleans.
  quantity: z
    .int({ error: 'Enter a whole-number quantity.' })
    .positive('Quantity must be at least 1.'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
export const orderIntentSchema = z.strictObject({
  key: z.string().min(1),
  input: createOrderSchema,
})
export type OrderIntent = z.infer<typeof orderIntentSchema>
export const orderListSchema = z.strictObject({
  page: z.int().positive(),
  pageSize: z.int().positive().max(100),
  status: orderStatusSchema.optional(),
})
export type OrderListInput = z.infer<typeof orderListSchema>

// The scheduled login/order forms can pass these directly to useForm.
export const loginFormOptions = {
  resolver: zodResolver(loginSchema),
  defaultValues: { email: '', password: '' },
} satisfies UseFormProps<LoginInput>

export const createOrderFormOptions = {
  resolver: zodResolver(createOrderSchema),
  defaultValues: { productId: '', quantity: 1 },
} satisfies UseFormProps<CreateOrderInput>
