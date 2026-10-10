import { useEffect, useRef } from 'react'
import { useOrder } from '../../api/orders'
import type { OrderAudience } from '../../api/orders'
import { ApiError } from '../../api/client'
import { useSessionError } from '../auth/use-session-error'
import { Loading } from '../../components/ui/Loading'
import { Feedback } from '../../components/ui/Feedback'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { OrderCancelAction } from './OrderCancelAction'
import { OrderPayAction } from './OrderPayAction'

export function OrderDetail({
  id,
  onBack,
  audience = 'customer',
  paymentNotice = null,
}: {
  id: string
  onBack: () => void
  audience?: OrderAudience
  paymentNotice?: 'success' | 'failure' | null
}) {
  const query = useOrder(id, audience)
  useSessionError(query.error)
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    section.current?.focus()
  }, [id])
  const order = query.data
  return (
    <section
      ref={section}
      tabIndex={-1}
      className="flex flex-col gap-5"
      aria-label="Order details"
    >
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" onClick={onBack}>
          {audience === 'operations'
            ? 'Back to operations orders'
            : 'Back to my orders'}
        </Button>
        <Button
          variant="outline"
          busy={query.isFetching}
          onClick={() => {
            void query.refetch()
          }}
        >
          Refresh order
        </Button>
      </div>
      {query.isPending ? (
        <Loading label="Loading order…" />
      ) : query.isError ? (
        <Feedback tone="error">
          {query.error instanceof ApiError
            ? query.error.message
            : 'Unable to load this order.'}
        </Feedback>
      ) : (
        order && (
          <>
            {audience === 'customer' && (
              <div className="flex flex-wrap items-start gap-3">
                <OrderPayAction
                  id={id}
                  pending={order.status === 'PENDING'}
                />
                <OrderCancelAction
                  id={id}
                  pending={order.status === 'PENDING'}
                  onRefresh={() => query.refetch()}
                />
              </div>
            )}
            {paymentNotice === 'success' && order.status === 'CONFIRMED' && (
              <Feedback tone="success">Payment confirmed.</Feedback>
            )}
            {paymentNotice === 'success' && order.status !== 'CONFIRMED' && (
              <Feedback tone="error">Payment did not complete.</Feedback>
            )}
            {paymentNotice === 'failure' && (
              <Feedback tone="error">
                {order.status === 'FAILED'
                  ? 'Payment failed. Reserved stock has been returned.'
                  : 'Payment did not complete.'}
              </Feedback>
            )}
            <div className="card border border-base-300 bg-base-100">
              <div className="card-body gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="card-title">{order.productName}</h2>
                  <StatusBadge status={order.status} />
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {audience === 'operations' && (
                    <div>
                      <dt className="text-sm text-base-content/75">
                        Customer ID
                      </dt>
                      <dd className="break-all font-mono text-sm">
                        {order.customerId}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm text-base-content/75">Product ID</dt>
                    <dd className="break-all font-mono text-sm">
                      {order.productId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-base-content/75">Order ID</dt>
                    <dd className="break-all font-mono text-sm">{order.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-base-content/75">Quantity</dt>
                    <dd>{order.quantity}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-base-content/75">Unit price</dt>
                    <dd>
                      LKR{' '}
                      {(order.unitPriceMinor / 100).toLocaleString('en-LK', {
                        minimumFractionDigits: 2,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-base-content/75">Total</dt>
                    <dd className="font-semibold">
                      LKR{' '}
                      {(order.totalMinor / 100).toLocaleString('en-LK', {
                        minimumFractionDigits: 2,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-base-content/75">Created</dt>
                    <dd>
                      <time dateTime={order.createdAt}>
                        {new Date(order.createdAt).toLocaleString()}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-base-content/75">Updated</dt>
                    <dd>
                      <time dateTime={order.updatedAt}>
                        {new Date(order.updatedAt).toLocaleString()}
                      </time>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <h3 className="text-lg font-semibold">Transition history</h3>
            <ol className="flex flex-col gap-3">
              {order.history.map((entry, index) => (
                <li
                  key={`${entry.occurredAt}:${index}`}
                  className="rounded-box border border-base-300 bg-base-100 p-4"
                >
                  <p>
                    {entry.fromStatus ?? 'Created'} → {entry.toStatus}
                  </p>
                  <p className="mt-1 text-sm text-base-content/75">
                    {entry.reason}
                  </p>
                  <time
                    className="text-xs text-base-content/75"
                    dateTime={entry.occurredAt}
                  >
                    {new Date(entry.occurredAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          </>
        )
      )}
    </section>
  )
}
