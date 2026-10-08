import { useState } from 'react'
import { useCancelOrder } from '../../api/orders'
import { ApiError } from '../../api/client'
import { useAuth } from '../auth/auth-context'
import { Button } from '../../components/ui/Button'
import { Feedback } from '../../components/ui/Feedback'

export function OrderCancelAction({
  id,
  pending,
  onRefresh,
}: {
  id: string
  pending: boolean
  onRefresh: () => Promise<unknown>
}) {
  const cancel = useCancelOrder(id)
  const { signOut } = useAuth()
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  async function submit() {
    setMessage('')
    setSuccess(false)
    try {
      await cancel.mutateAsync()
      setSuccess(true)
      setMessage('Order cancelled. Reserved stock has been returned.')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        signOut()
        return
      }
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The cancellation result is uncertain. Refresh the order before retrying.',
      )
      // 409 means the displayed PENDING state was stale; uncertain failures
      // may also have committed, so always discover the current state.
      await onRefresh()
    }
  }
  return (
    <div className="flex flex-col gap-3">
      {pending && (
        <Button
          variant="outline"
          busy={cancel.isPending}
          onClick={() => {
            void submit()
          }}
        >
          Cancel pending order
        </Button>
      )}
      {message && (
        <Feedback tone={success ? 'success' : 'error'}>{message}</Feedback>
      )}
    </div>
  )
}
