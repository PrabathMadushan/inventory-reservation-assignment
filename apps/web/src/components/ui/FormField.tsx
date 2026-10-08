import { cloneElement } from 'react'
import type { InputHTMLAttributes, ReactElement } from 'react'

type FormFieldProps = {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactElement<InputHTMLAttributes<HTMLInputElement>>
}

// Keep register()/validation in the feature; this wrapper owns accessible labels.
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: FormFieldProps) {
  const descriptionIds = [
    children.props['aria-describedby'],
    hint && `${id}-hint`,
    error && `${id}-error`,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        'aria-describedby': descriptionIds || undefined,
        className: `input w-full ${error ? 'input-error' : ''} ${children.props.className ?? ''}`,
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-base-content/75">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}
