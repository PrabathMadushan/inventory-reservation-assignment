import { useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { Button } from '../../components/ui/Button'
import { Feedback } from '../../components/ui/Feedback'
import { beginPayment, paymentGatewayUrl } from './payment'

export function OrderPayAction({
  id,
  pending,
}: {
  id: string
  pending: boolean
}) {
  const { session } = useAuth()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  if (!pending || !session) return null
  return (
    <div className="flex flex-col gap-3">
      <Button
        busy={busy}
        onClick={() => {
          setBusy(true)
          setMessage('')
          void beginPayment({
            gateway: paymentGatewayUrl(),
            token: session.accessToken,
            orderId: id,
            origin: window.location.origin,
          }).catch((error: unknown) => {
            setBusy(false)
            setMessage(
              error instanceof Error
                ? error.message
                : 'Payment could not be started.',
            )
          })
        }}
      >
        Pay
      </Button>
      {message && <Feedback tone="error">{message}</Feedback>}
    </div>
  )
}
