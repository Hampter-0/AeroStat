'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { updateProfile } from '@/app/manage/(panel)/profile/actions'
import { useResultToast } from '@/components/manage/toast/Toasts'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function AccountForm({ username, email }: { username: string; email: string | null }) {
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
      <input type="hidden" name="email" value={emailValue} />
      <label>
        <span>Username</span>
        <input
          key={'username-' + username}
          name="username"
          defaultValue={username}
          required
          minLength={2}
          maxLength={32}
          pattern="[a-zA-Z0-9._\-]+"
          autoComplete="username"
        />
        <small className="field-hint">You sign in with this or your email address.</small>
      </label>
      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={pending}>
          {buttonText}
        </button>
      </div>
    </form>
  )
}
