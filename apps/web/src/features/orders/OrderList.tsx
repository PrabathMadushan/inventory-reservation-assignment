import { useEffect, useRef } from 'react'
import { useOrders } from '../../api/orders'
import type { OrderAudience } from '../../api/orders'
import { ApiError } from '../../api/client'
import { useSessionError } from '../auth/use-session-error'
import { orderStatusSchema } from '../../validation/api'
import type { Order } from '../../validation/api'
import type { OrderListInput } from '../../validation/forms'
import { DataTable } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { StatusBadge } from '../../components/ui/StatusBadge'

export function OrderList({
  onSelect,
  audience,
  parameters,
  onParameters,
}: {
  onSelect: (id: string) => void
  audience: OrderAudience
  parameters: OrderListInput
  onParameters: (value: OrderListInput) => void
}) {
  const { page, status } = parameters
  const query = useOrders(parameters, audience)
  useSessionError(query.error)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const operations = audience === 'operations'
  const columns = [
    ...(operations
      ? [
          {
            key: 'customer',
            label: 'Customer ID',
            render: (order: Order) => (
              <span className="break-all font-mono text-xs">
                {order.customerId}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'product',
      label: 'Product',
      render: (order: Order) => order.productName,
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (order: Order) => order.quantity,
    },
    {
      key: 'total',
      label: 'Total (LKR)',
      render: (order: Order) =>
        (order.totalMinor / 100).toLocaleString('en-LK', {
          minimumFractionDigits: 2,
        }),
    },
    {
      key: 'status',
      label: 'Status',
      render: (order: Order) => <StatusBadge status={order.status} />,
    },
    {
      key: 'detail',
      label: 'Details',
      render: (order: Order) => (
        <Button
          variant="ghost"
          aria-label={`View order ${order.id}`}
          onClick={() => onSelect(order.id)}
        >
          View order
        </Button>
      ),
    },
  ]
  return (
    <section aria-labelledby="orders-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2
          ref={heading}
          tabIndex={-1}
          id="orders-title"
          className="text-xl font-semibold"
        >
          {operations ? 'Operations orders' : 'My orders'}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Status
            <select
              className="select"
              value={status ?? ''}
              onChange={(event) => {
                onParameters({
                  ...parameters,
                  page: 1,
                  status: event.target.value
                    ? orderStatusSchema.parse(event.target.value)
                    : undefined,
                })
              }}
            >
              <option value="">All statuses</option>
              {orderStatusSchema.options.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            busy={query.isFetching}
            onClick={() => {
              void query.refetch()
            }}
          >
            Refresh orders
          </Button>
        </div>
      </div>
      <DataTable
        caption={operations ? 'All customer orders' : 'Your orders'}
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(order) => order.id}
        loading={query.isPending || query.isFetching}
        error={
          query.isError
            ? query.error instanceof ApiError
              ? query.error.message
              : 'Unable to load orders. Please try refreshing.'
            : undefined
        }
        emptyTitle="No orders match this filter."
      />
      {query.data && !query.isError && (
        <Pagination
          page={page}
          pageSize={parameters.pageSize}
          total={query.data.total}
          busy={query.isFetching}
          onPage={(page) => onParameters({ ...parameters, page })}
        />
      )}
    </section>
  )
}
