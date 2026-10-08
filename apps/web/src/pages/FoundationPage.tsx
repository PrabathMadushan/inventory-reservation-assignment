import { PageHeader } from '../components/layout/PageHeader'
import { ConnectionCard } from '../features/connection/ConnectionCard'

export function FoundationPage() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
      <PageHeader
        eyebrow="Inventory reservation"
        title="Orders, kept in order."
        description="Keep track of products, reservations and order updates in one place."
      />
      <ConnectionCard />
    </div>
  )
}
