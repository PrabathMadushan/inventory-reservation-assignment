import { renderToString } from 'react-dom/server'
import { onlineManager, QueryClientProvider } from '@tanstack/react-query'
import { expect, it } from 'vitest'
import { FoundationPage } from './pages/FoundationPage'
import { createQueryClient } from './api/query-client'

it('does not report a successful connection before the first offline query completes', () => {
  const client = createQueryClient()
  const wasOnline = onlineManager.isOnline()
  onlineManager.setOnline(false)
  try {
    const html = renderToString(
      <QueryClientProvider client={client}>
        <FoundationPage />
      </QueryClientProvider>,
    )
    expect(html).toContain('Connecting…')
    expect(html).not.toContain('Application connected.')
  } finally {
    client.clear()
    onlineManager.setOnline(wasOnline)
  }
})
