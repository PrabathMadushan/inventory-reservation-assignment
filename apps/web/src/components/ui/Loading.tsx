export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 py-4 text-base-content/75"
    >
      <span
        aria-hidden="true"
        className="loading loading-spinner loading-sm motion-reduce:animate-none"
      />
      <span>{label}</span>
    </div>
  )
}
