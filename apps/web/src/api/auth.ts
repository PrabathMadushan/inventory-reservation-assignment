import { useMutation } from '@tanstack/react-query'
import { apiRequest } from './client'
import { loginResponseSchema } from '../validation/api'
import { loginSchema } from '../validation/forms'
import type { LoginInput } from '../validation/forms'

export function useLogin() {
  return useMutation({
    mutationKey: ['login'],
    mutationFn: (input: LoginInput) =>
      apiRequest('/auth/login', loginResponseSchema, {
        method: 'POST',
        body: loginSchema.parse(input),
      }),
    retry: false,
    // Do not retain login inputs/passwords in the inactive mutation cache.
    gcTime: 0,
  })
}
