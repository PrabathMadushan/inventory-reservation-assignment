import { Button } from './Button'

export function Pagination({
  page,
  pageSize,
  total,
  busy,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  busy?: boolean
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <nav
      aria-label="Order pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p role="status" className="text-sm">
        Page {page} of {pages} · {total} {total === 1 ? 'order' : 'orders'}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={page <= 1 || busy}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={page >= pages || busy}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  )
}
