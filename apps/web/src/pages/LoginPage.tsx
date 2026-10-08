import { PageHeader } from '../components/layout/PageHeader'
import { LoginForm } from '../features/auth/LoginForm'

export function LoginPage() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
      <PageHeader
        eyebrow="Inventory reservation"
        title="Orders, kept in order."
        description="Sign in to browse products and keep track of your orders."
      />
      <LoginForm />
    </div>
  )
}
