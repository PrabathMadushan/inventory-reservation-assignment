import { useState } from 'react'
import type { OrderAudience } from '../../api/orders'
import type { OrderListInput } from '../../validation/forms'
import { OrderList } from './OrderList'
import { OrderDetail } from './OrderDetail'

// Keep filter/page state while inspecting a detail and returning to the list.
export function OrderBrowser({
  audience,
  selectedId,
  onSelect,
}: {
  audience: OrderAudience
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const [parameters, setParameters] = useState<OrderListInput>({
    page: 1,
    pageSize: 10,
  })
  return selectedId ? (
    <OrderDetail
      id={selectedId}
      audience={audience}
      onBack={() => onSelect(null)}
    />
  ) : (
    <OrderList
      audience={audience}
      onSelect={onSelect}
      parameters={parameters}
      onParameters={setParameters}
    />
  )
}
