import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateOrder } from '../../api/orders'
import { ApiError } from '../../api/client'
import { createOrderFormOptions } from '../../validation/forms'
import type { Order, Product } from '../../validation/api'
import type { OrderIntentManager } from './use-order-intent'
import { Button } from '../../components/ui/Button'
import { Feedback } from '../../components/ui/Feedback'
import { FormField } from '../../components/ui/FormField'
import { useAuth } from '../auth/auth-context'

export function OrderCreateForm({
  product,
  intentManager,
  onCreated,
  onClose,
}: {
  product: Product | null
  intentManager: OrderIntentManager
  onCreated: (order: Order) => void
  onClose: () => void
}) {
  const { intent } = intentManager
  const create = useCreateOrder()
  const { signOut } = useAuth()
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    ...createOrderFormOptions,
    defaultValues: intent?.input ?? {
      productId: product?.id ?? '',
      quantity: 1,
    },
  })
  const submit = handleSubmit(async (input) => {
    setError('')
    let key: string | undefined
    try {
      const attempt = intentManager.begin(input)
      key = attempt.key
      const order = await create.mutateAsync(attempt)
      intentManager.clear(key)
      onCreated(order)
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        key &&
        [400, 404, 409].includes(failure.status)
      )
        intentManager.clear(key)
      if (failure instanceof ApiError && failure.status === 401) {
        signOut()
        return
      }
      setError(
        failure instanceof ApiError
          ? failure.message
          : key
            ? 'The result is uncertain. Retry the same reservation to confirm it.'
            : failure instanceof Error
              ? failure.message
              : 'Unable to reserve this product.',
      )
    }
  })
  return (
    <section
      aria-labelledby="reserve-title"
      className="card border border-base-300 bg-base-100"
    >
      <div className="card-body gap-5">
        <h2 id="reserve-title" className="card-title">
          {product ? `Reserve ${product.name}` : 'Resume your reservation'}
        </h2>
        {intent && !isSubmitting && (
          <Feedback tone="info">
            A reservation is awaiting confirmation. Retry with the same product
            and quantity.
          </Feedback>
        )}
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <input type="hidden" {...register('productId')} />
          <FormField
            id="order-quantity"
            label="Quantity"
            error={errors.quantity?.message}
            hint="Enter a positive whole number."
          >
            <input
              type="number"
              min="1"
              step="1"
              readOnly={!!intent}
              {...register('quantity', { valueAsNumber: true })}
            />
          </FormField>
          {error && <Feedback tone="error">{error}</Feedback>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" busy={isSubmitting}>
              {isSubmitting
                ? 'Reserving…'
                : intent
                  ? 'Retry same reservation'
                  : 'Create pending order'}
            </Button>
            {!intent && (
              <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </form>
      </div>
    </section>
  )
}
