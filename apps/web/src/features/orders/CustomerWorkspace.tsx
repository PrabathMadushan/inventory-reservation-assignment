import { useState } from 'react'
import { useProducts } from '../../api/products'
import { useAuth } from '../auth/auth-context'
import { ProductList } from '../products/ProductList'
import { OrderCreateForm } from './OrderCreateForm'
import { OrderBrowser } from './OrderBrowser'
import { WorkspaceNav } from '../../components/layout/WorkspaceNav'
import { useOrderIntent } from './use-order-intent'
import type { Product, OrderStatus } from '../../validation/api'
import { Feedback } from '../../components/ui/Feedback'

export function CustomerWorkspace() {
  const { session } = useAuth()
  const intentManager = useOrderIntent(session!.user.id)
  const [view, setView] = useState<'products' | 'orders'>('products')
  const [selected, setSelected] = useState<Product | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [success, setSuccess] = useState<OrderStatus | null>(null)
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
