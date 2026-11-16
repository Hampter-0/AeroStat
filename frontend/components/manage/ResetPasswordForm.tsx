'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { confirmPasswordReset } from '@/app/manage/password-reset-actions'
import { Lock } from '@/components/icons'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(confirmPasswordReset, initialState)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  if (state.success) {
    return (
      <div className="manage-form">
        <p className="login-notice">{state.success}</p>
        <Link href="/manage/login" className="button-primary login-button-link">
          Sign in
        </Link>
      </div>
    )
  }

  let buttonText = 'Save new password'
  if (pending) {
    buttonText = 'Saving…'
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      <input type="hidden" name="token" value={token} />
      <label>
        <span>New password</span>
        <div className="input-with-icon">
          <Lock />
          <input name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
        </div>
      </label>
      <label>
        <span>Repeat new password</span>
        <div className="input-with-icon">
          <Lock />
          <input name="repeat" type="password" autoComplete="new-password" minLength={8} required />
        </div>
      </label>
      <small className="field-hint">At least 8 characters. You are signed out on every device afterwards.</small>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" className="button-primary" disabled={pending}>
        {buttonText}
      </button>
    </form>
  )
}
