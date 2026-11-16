'use client'

import { useActionState, useEffect, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { requestPasswordReset } from '@/app/manage/password-reset-actions'
import { Mail } from '@/components/icons'
import { useKeepValuesSubmit } from '@/lib/use-form-submit'
import { useResultToast } from '@/components/manage/toast/Toasts'

const initialState: FormState = { error: null, success: null }

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState)
  useResultToast(state)
  const onSubmit = useKeepValuesSubmit(formAction)
  const [email, setEmail] = useState('')

  useEffect(
    function () {
      if (state.success) {
        window.setTimeout(function () {
          setEmail('')
        }, 0)
      }
    },
    [state],
  )

  function changeEmail(event: React.ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value)
  }

  let buttonText = 'Request password reset'
  if (pending) {
    buttonText = 'Sending…'
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="manage-form">
      <label>
        <span>Email</span>
        <div className="input-with-icon">
          <Mail />
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={changeEmail}
            required
            autoFocus
          />
        </div>
      </label>
      <button type="submit" className="button-primary" disabled={pending || email.trim() === ''}>
        {buttonText}
      </button>
      <small className="field-hint">No email after a few minutes? Check your spam folder, or ask an admin.</small>
    </form>
  )
}
