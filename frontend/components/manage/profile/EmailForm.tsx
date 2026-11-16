'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { updateProfile } from '@/app/manage/(panel)/profile/actions'
import { useResultToast } from '@/components/manage/toast/Toasts'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function EmailForm({ username, email }: { username: string; email: string | null }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState)
  useResultToast(state)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  let emailValue = ''
  if (email) {
    emailValue = email
  }

  let buttonText = 'Update'
  if (pending) {
    buttonText = 'Saving…'
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      <input type="hidden" name="username" value={username} />
      <label>
        <span>Email</span>
        <input key={'email-' + emailValue} name="email" type="email" defaultValue={emailValue} autoComplete="email" placeholder="you@example.com" />
        <small className="field-hint">For email notifications. Leave empty to remove it.</small>
      </label>
      <label>
        <span>Current password</span>
        <input name="current_password" type="password" autoComplete="current-password" />
        <small className="field-hint">Needed to change your email address.</small>
      </label>
      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={pending}>
          {buttonText}
        </button>
      </div>
    </form>
  )
}
