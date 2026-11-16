'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { requestPasswordReset } from '@/app/manage/password-reset-actions'
import { AtSign, ChevronLeft } from '@/components/icons'
import { useKeepValuesSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState)
  const onSubmit = useKeepValuesSubmit(formAction)

  if (state.success) {
    return (
      <div className="manage-form">
        <p className="login-notice">{state.success}</p>
        <p className="field-hint">No email after a few minutes? Check your spam folder, or ask an admin.</p>
        <Link href="/manage/login" className="login-back">
          <ChevronLeft /> Back to sign in
        </Link>
      </div>
    )
  }

  let buttonText = 'Send reset link'
  if (pending) {
    buttonText = 'Sending…'
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="manage-form">
      <label>
        <span>Email</span>
        <div className="input-with-icon">
          <AtSign />
          <input name="email" type="email" autoComplete="email" required autoFocus />
        </div>
      </label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" className="button-primary" disabled={pending}>
        {buttonText}
      </button>
      <Link href="/manage/login" className="login-back">
        <ChevronLeft /> Back to sign in
      </Link>
    </form>
  )
}
