import { useProducts } from '../../api/products'
import { useSessionError } from '../auth/use-session-error'
import { DataTable } from '../../components/ui/DataTable'
import type { TableColumn } from '../../components/ui/DataTable'
import type { Product } from '../../validation/api'
import { Button } from '../../components/ui/Button'

const columns: TableColumn<Product>[] = [
  { key: 'name', label: 'Product', render: (product) => product.name },
  {
    key: 'price',
    label: 'Unit price (LKR)',
    render: (product) =>
      new Intl.NumberFormat('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(product.unitPriceMinor / 100),
  },
  {
    key: 'stock',
    label: 'Available',
    render: (product) => product.availableQuantity,
  },
]

export function ProductList({
  onSelect,
  reservationPending = false,
}: {
  onSelect?: (product: Product) => void
  reservationPending?: boolean
}) {
  const products = useProducts()
  useSessionError(products.error)
  return (
    <section aria-labelledby="products-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="products-title" className="text-xl font-semibold">
          Available products
        </h2>
        <Button
          variant="outline"
          busy={products.isFetching}
          onClick={() => {
            void products.refetch()
          }}
        >
          Refresh products
        </Button>
      </div>
      <DataTable
        caption="Products"
        columns={
          onSelect
            ? [
                ...columns,
                {
                  key: 'reserve',
                  label: 'Reserve',
                  render: (product) => (
                    <Button
                      disabled={
                        reservationPending || product.availableQuantity === 0
                      }
                      onClick={() => onSelect(product)}
                      aria-label={`Reserve ${product.name}`}
                    >
                      Reserve
                    </Button>
                  ),
                },
              ]
            : columns
        }
        rows={products.data?.items ?? []}
        rowKey={(product) => product.id}
        loading={products.isPending || products.isFetching}
        error={
          products.isError
            ? 'Unable to load products. Please try refreshing.'
            : undefined
        }
        emptyTitle="No products available."
      />
    </section>
  )
}
