import { useEffect, useState } from 'react'
import { useProducts } from '../../api/products'
import { useAuth } from '../auth/auth-context'
import { ProductList } from '../products/ProductList'
import { OrderCreateForm } from './OrderCreateForm'
import { OrderBrowser } from './OrderBrowser'
import { WorkspaceNav } from '../../components/layout/WorkspaceNav'
import { useOrderIntent } from './use-order-intent'
import type { Product, OrderStatus } from '../../validation/api'
import { Feedback } from '../../components/ui/Feedback'
import { readPaymentReturn } from './payment'

export function CustomerWorkspace() {
  const { session } = useAuth()
  const intentManager = useOrderIntent(session!.user.id)
  const [paymentReturn] = useState(() =>
    readPaymentReturn(window.location.search),
  )
  const [view, setView] = useState<'products' | 'orders'>(() =>
    paymentReturn ? 'orders' : 'products',
  )
  const [selected, setSelected] = useState<Product | null>(null)
  const [orderId, setOrderId] = useState<string | null>(
    () => paymentReturn?.orderId ?? null,
  )
  const [success, setSuccess] = useState<OrderStatus | null>(null)
  useEffect(() => {
    if (!paymentReturn) return
    const url = new URL(window.location.href)
    url.searchParams.delete('payment')
    url.searchParams.delete('orderId')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [paymentReturn])
  // Observe the product table's cache without starting a second fetch.
  const products = useProducts({ enabled: false })
  const { intent } = intentManager
  const product = intent
    ? (products.data?.items.find(
        (item) => item.id === intent.input.productId,
      ) ?? selected)
    : selected
  return (
    <div className="flex flex-col gap-6">
      <WorkspaceNav
        value={view}
        ordersLabel="My orders"
        onChange={(value) => {
          setView(value)
          if (value === 'orders') {
            setOrderId(null)
            setSuccess(null)
          }
        }}
      />
      {view === 'products' ? (
        <>
          <ProductList
            onSelect={setSelected}
            reservationPending={!!intentManager.intent}
          />
          {(selected || intentManager.intent) && (
            <OrderCreateForm
              key={intentManager.intent?.input.productId ?? selected?.id}
              product={product}
              intentManager={intentManager}
              onClose={() => setSelected(null)}
              onCreated={(order) => {
                setOrderId(order.id)
                setSelected(null)
                setView('orders')
                setSuccess(order.status)
              }}
            />
          )}
        </>
      ) : (
        <>
          {success && (
            <Feedback tone="success">Order request completed.</Feedback>
          )}
          <OrderBrowser
            audience="customer"
            selectedId={orderId}
            paymentNotice={
              paymentReturn && orderId === paymentReturn.orderId
                ? paymentReturn.payment
                : null
            }
            onSelect={(id) => {
              setOrderId(id)
              setSuccess(null)
            }}
          />
        </>
      )}
    </div>
  )
}
