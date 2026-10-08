import { useRef, useState } from 'react'
import { orderIntentSchema } from '../../validation/forms'
import type { CreateOrderInput, OrderIntent } from '../../validation/forms'

export function useOrderIntent(customerId: string) {
  const storageKey = `reservation-intent:${customerId}`
  const [intent, setIntent] = useState<OrderIntent | null>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (!saved) return null
      const parsed = orderIntentSchema.safeParse(JSON.parse(saved))
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  })
  const current = useRef(intent)

  function begin(input: CreateOrderInput): OrderIntent {
    if (current.current) {
      if (
        current.current.input.productId !== input.productId ||
        current.current.input.quantity !== input.quantity
      ) {
        throw new Error(
          'Retry the original reservation before changing its product or quantity.',
        )
      }
      return current.current
    }
    const next = { key: crypto.randomUUID(), input: { ...input } }
    // Persist before sending: reload/navigation must not silently create a new key.
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      throw new Error(
        'Unable to save retry details in this browser. Allow session storage and try again.',
      )
    }
    current.current = next
    setIntent(next)
    return next
  }

  function clear(key: string) {
    if (current.current?.key !== key) return
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      /* A retained key can only replay the same completed request. */
    }
    current.current = null
    setIntent(null)
  }
  return { intent, begin, clear }
}
export type OrderIntentManager = ReturnType<typeof useOrderIntent>
