import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'
import { DataTable } from './DataTable'
import { FormField } from './FormField'
import { Loading } from './Loading'

describe('Shared component semantics and state boundaries', () => {
  const columns = [
    {
      key: 'name',
      label: 'Product',
      render: (row: { id: string; name: string }) => row.name,
    },
  ]
  const rows = [{ id: 'product-one', name: 'Mechanical Keyboard' }]
  const props = {
    caption: 'Products',
    columns,
    rows,
    rowKey: (row: { id: string }) => row.id,
  }

  it('disables a busy action and defaults to a non-submit button', () => {
    const html = renderToStaticMarkup(<Button busy>Save</Button>)
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('type="button"')
  })

  it('announces loading text while keeping its decorative spinner hidden', () => {
    const html = renderToStaticMarkup(<Loading label="Loading orders…" />)
    expect(html).toContain('role="status"')
    expect(html).toContain('Loading orders…')
    expect(html).toContain('aria-hidden="true"')
  })

  it('renders a semantic table with caption, column headers, and a keyboard-accessible scroll region', () => {
    const html = renderToStaticMarkup(<DataTable {...props} />)
    expect(html).toContain('<table')
    expect(html).toContain('<caption')
    expect(html).toContain('scope="col"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('Mechanical Keyboard')
  })

  it('replaces stale table rows with announced loading or error feedback', () => {
    const loading = renderToStaticMarkup(<DataTable {...props} loading />)
    expect(loading).toContain('Loading products…')
    expect(loading).not.toContain('Mechanical Keyboard')
    const error = renderToStaticMarkup(
      <DataTable {...props} error="Could not load products." />,
    )
    expect(error).toContain('role="alert"')
    expect(error).not.toContain('<table')
  })

  it('shows the supplied empty message for an empty result', () => {
    const html = renderToStaticMarkup(
      <DataTable {...props} rows={[]} emptyTitle="No orders yet." />,
    )
    expect(html).toContain('No orders yet.')
    expect(html).not.toContain('<table')
  })

  it('links a form label, existing description, hint, and validation error to its input', () => {
    const html = renderToStaticMarkup(
      <FormField
        id="quantity"
        label="Quantity"
        hint="Whole numbers only."
        error="Quantity is required."
      >
        <input name="quantity" aria-describedby="external-help" />
      </FormField>,
    )
    expect(html).toContain('for="quantity"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain(
      'aria-describedby="external-help quantity-hint quantity-error"',
    )
    expect(html).toContain('role="alert"')
  })
})
