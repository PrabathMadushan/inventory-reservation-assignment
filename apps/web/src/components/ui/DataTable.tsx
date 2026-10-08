import type { Key, ReactNode } from 'react'
import { Loading } from './Loading'
import { Feedback } from './Feedback'
import { EmptyState } from './EmptyState'

export type TableColumn<T> = {
  key: string
  label: string
  render: (row: T) => ReactNode
}

type DataTableProps<T> = {
  caption: string
  columns: readonly TableColumn<T>[]
  rows: readonly T[]
  rowKey: (row: T) => Key
  loading?: boolean
  error?: string
  emptyTitle?: string
}

// Features supply server pagination/filtering; this component only renders.
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  loading = false,
  error,
  emptyTitle = 'No results yet.',
}: DataTableProps<T>) {
  if (loading) return <Loading label={`Loading ${caption.toLowerCase()}…`} />
  if (error) return <Feedback tone="error">{error}</Feedback>
  if (rows.length === 0) return <EmptyState title={emptyTitle} />
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="overflow-x-auto rounded-box border border-base-300"
    >
      <table className="table table-zebra">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
