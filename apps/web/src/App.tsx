import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './pages/LoginPage'
import { WorkspacePage } from './pages/WorkspacePage'
import { AuthProvider } from './features/auth/AuthProvider'
import { useAuth } from './features/auth/auth-context'
import { Button } from './components/ui/Button'

function AuthenticatedApp() {
  const { session, signOut } = useAuth()
  return (
    <AppShell
      accountActions={
        session ? (
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        ) : undefined
      }
    >
      {session ? <WorkspacePage key={session.user.id} /> : <LoginPage />}
    </AppShell>
  )
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}

export default App
