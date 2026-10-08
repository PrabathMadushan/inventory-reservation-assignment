import type { ReactNode } from 'react'

export function AppShell({
  children,
  accountActions,
}: {
  children: ReactNode
  accountActions?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-base-200/60 text-base-content">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:rounded-box focus:bg-base-100 focus:p-4"
      >
        Skip to content
      </a>
      <header className="border-b border-base-300 bg-base-100">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-5 sm:px-8">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-xl bg-primary text-primary-content"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="size-6"
            >
              <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
              <path d="m4 7.5 8 4.5 8-4.5M12 12v9m-4-16.5 8 4.5" />
            </svg>
          </span>
          <div>
            <p className="font-semibold tracking-tight">Inventory & orders</p>
            <p className="text-xs text-base-content/75">
              A little more order. A lot less effort.
            </p>
          </div>
          <span className="badge badge-outline ml-auto shrink-0 text-xs">
            LKR
          </span>
          {accountActions}
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-20"
      >
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-5 py-6 text-xs text-base-content/75 sm:px-8">
        Inventory reservation and order management
      </footer>
    </div>
  )
}
