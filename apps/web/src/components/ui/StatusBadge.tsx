import type { OrderStatus } from '../../validation/api'

const colors: Record<OrderStatus, string> = {
  PENDING: 'badge-warning',
  CONFIRMED: 'badge-success',
  FAILED: 'badge-error',
  CANCELLED: 'badge-neutral',
}
export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-soft ${colors[status]}`}>{status}</span>
}
