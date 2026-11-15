'use client'

import { useActionState } from 'react'
import { login, type FormState } from '@/app/manage/actions'
import { Lock, User } from '@/components/icons'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  let buttonText = 'Continue'
  if (pending) {
    buttonText = 'Signing in…'
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      <label>
        <span>Username or email</span>
        <div className="input-with-icon">
          <User />
          <input name="username" autoComplete="username" required autoFocus />
        </div>
      </label>
      <label>
        <span>Password</span>
        <div className="input-with-icon">
          <Lock />
          <input name="password" type="password" autoComplete="current-password" required />
        </div>
      </label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" className="button-primary" disabled={pending}>
        {buttonText}
      </button>
    </form>
  )
}
