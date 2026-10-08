import { useState } from 'react'
import { WorkspaceNav } from '../../components/layout/WorkspaceNav'
import type { WorkspaceView } from '../../components/layout/WorkspaceNav'
import { ProductList } from '../products/ProductList'
import { OrderBrowser } from './OrderBrowser'

export function OperationsWorkspace() {
  const [view, setView] = useState<WorkspaceView>('products')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-6">
      <WorkspaceNav
        value={view}
        ordersLabel="Operations orders"
        onChange={(value) => {
          setView(value)
          if (value === 'orders') setSelectedId(null)
        }}
      />
      {view === 'products' ? (
        <ProductList />
      ) : (
        <OrderBrowser
          audience="operations"
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}
    </div>
  )
}
