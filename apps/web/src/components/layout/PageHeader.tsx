export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description?: string
}) {
  return (
    <div className="max-w-xl">
      {eyebrow && (
        <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-base-content/75 uppercase">
          {eyebrow}
        </p>
      )}
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        {title}
      </h1>
      {description && (
        <p className="mt-5 max-w-md text-base leading-relaxed text-base-content/75">
          {description}
        </p>
      )}
    </div>
  )
}
