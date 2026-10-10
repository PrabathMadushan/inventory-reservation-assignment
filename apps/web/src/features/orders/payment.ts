const orderIdPattern = /^[A-Za-z0-9_-]{1,256}$/
const ticketPattern = /^[0-9a-f]{64}$/

export function paymentGatewayUrl() {
  return (
    import.meta.env.VITE_PAYMENT_GATEWAY_URL || 'http://127.0.0.1:4001'
  ).replace(/\/$/, '')
}

export function readPaymentReturn(
  search: string,
): { payment: 'success' | 'failure'; orderId: string } | null {
  const params = new URLSearchParams(search)
  const payment = params.get('payment')
  const orderId = params.get('orderId')
  if (
    (payment === 'success' || payment === 'failure') &&
    orderId &&
    orderIdPattern.test(orderId)
  ) {
    return { payment, orderId }
  }
  return null
}

export async function beginPayment({
  gateway,
  token,
  orderId,
  origin,
  fetchImpl = fetch,
  navigate = (url: string) => window.location.assign(url),
}: {
  gateway: string
  token: string
  orderId: string
  origin: string
  fetchImpl?: typeof fetch
  navigate?: (url: string) => void
}) {
  const base = gateway.replace(/\/$/, '')
  const response = await fetchImpl(`${base}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId, returnOrigin: origin }),
  })
  const body: unknown = await response.json().catch(() => null)
  const ticket =
    body &&
    typeof body === 'object' &&
    'ticket' in body &&
    typeof body.ticket === 'string'
      ? body.ticket
      : ''
  if (!response.ok || !ticketPattern.test(ticket)) {
    const message =
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'Payment could not be started.'
    throw new Error(message)
  }
  navigate(`${base}/checkout?ticket=${encodeURIComponent(ticket)}`)
}
