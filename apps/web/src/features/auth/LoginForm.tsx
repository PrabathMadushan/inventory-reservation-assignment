import { useForm } from 'react-hook-form'
import { useLogin } from '../../api/auth'
import { ApiError } from '../../api/client'
import { loginFormOptions } from '../../validation/forms'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Feedback } from '../../components/ui/Feedback'
import { useAuth } from './auth-context'

export function LoginForm() {
  const { signIn } = useAuth()
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    resetField,
  } = useForm(loginFormOptions)
  const submit = handleSubmit(async (input) => {
    try {
      const session = await login.mutateAsync(input)
      resetField('password')
      login.reset()
      signIn(session)
    } catch {
      // The mutation supplies readable feedback; preserve fields for correction.
    }
  })
  return (
    <section
      aria-labelledby="login-title"
      className="card border border-base-300 bg-base-100 shadow-sm"
    >
      <div className="card-body gap-5 p-6 sm:p-8">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-base-content/75">
            Welcome back
          </p>
          <h2 id="login-title" className="card-title text-xl">
            Sign in to continue
          </h2>
        </div>
        <form noValidate onSubmit={submit} className="flex flex-col gap-5">
          <FormField
            id="email"
            label="Email address"
            error={errors.email?.message}
          >
            <input
              type="email"
              autoComplete="username"
              {...register('email')}
            />
          </FormField>
          <FormField
            id="password"
            label="Password"
            error={errors.password?.message}
          >
            <input
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
          </FormField>
          {login.isError && (
            <Feedback tone="error">
              {login.error instanceof ApiError
                ? login.error.message
                : 'Unable to sign in. Check your connection and try again.'}
            </Feedback>
          )}
          <Button type="submit" busy={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </section>
  )
}
