export type WorkspaceView = 'products' | 'orders'

export function WorkspaceNav({
  value,
  ordersLabel,
  onChange,
}: {
  value: WorkspaceView
  ordersLabel: string
  onChange: (value: WorkspaceView) => void
}) {
  return (
    <nav aria-label="Workspace" className="tabs tabs-box w-fit">
      {(['products', 'orders'] as const).map((view) => (
        <button
          key={view}
          type="button"
          className={`tab text-base-content ${value === view ? 'tab-active' : ''}`}
          aria-current={value === view ? 'page' : undefined}
          onClick={() => onChange(view)}
        >
          {view === 'products' ? 'Products' : ordersLabel}
        </button>
      ))}
    </nav>
  )
}
