'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { confirmPasswordReset } from '@/app/manage/password-reset-actions'
import PasswordInput from '@/components/manage/PasswordInput'
import { useFormSubmit } from '@/lib/use-form-submit'
import { useResultToast } from '@/components/manage/toast/Toasts'

const initialState: FormState = { error: null, success: null }

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(confirmPasswordReset, initialState)
  useResultToast(state)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  let buttonText = 'Save new password'
  if (pending) {
    buttonText = 'Saving…'
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      <input type="hidden" name="token" value={token} />
      <label>
        <span>New password</span>
        <PasswordInput name="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} autoFocus />
      </label>
      <label>
        <span>Repeat new password</span>
        <PasswordInput name="repeat" autoComplete="new-password" placeholder="Enter it again" minLength={8} />
      </label>
      <small className="field-hint">You are signed out on every device afterwards.</small>
      <button type="submit" className="button-primary" disabled={pending}>
        {buttonText}
      </button>
    </form>
  )
}
