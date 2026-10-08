import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div
      role="status"
      className="rounded-box border border-dashed border-base-300 bg-base-200/40 px-6 py-10 text-center"
    >
      <p className="font-semibold">{title}</p>
      {description && (
        <p className="mt-2 text-sm text-base-content/75">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
