import type { ReactNode } from 'react'

export function Feedback({
  tone,
  children,
}: {
  tone: 'success' | 'error' | 'info'
  children: ReactNode
}) {
  const styles = {
    success: 'alert-success alert-soft',
    error: 'alert-error alert-soft',
    info: 'alert-info alert-soft',
  }
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`alert ${styles[tone]}`}
    >
      <span>{children}</span>
    </div>
  )
}
