import { PageHeader } from '../components/layout/PageHeader'
import { useAuth } from '../features/auth/auth-context'
import { CustomerWorkspace } from '../features/orders/CustomerWorkspace'
import { OperationsWorkspace } from '../features/orders/OperationsWorkspace'

export function WorkspacePage() {
  const { session } = useAuth()
  const operations = session?.user.role === 'OPERATIONS'
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={operations ? 'Operations workspace' : 'Customer workspace'}
        title={operations ? 'Order operations' : 'Your inventory & orders'}
        description={`Signed in as ${session?.user.email ?? ''}`}
      />
      {operations ? <OperationsWorkspace /> : <CustomerWorkspace />}
    </div>
  )
}
