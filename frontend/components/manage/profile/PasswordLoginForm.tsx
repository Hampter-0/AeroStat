'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { setPasswordLogin } from '@/app/manage/(panel)/profile/passkey-actions'
import { useResultToast } from '@/components/manage/toast/Toasts'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function PasswordLoginForm({ enabled, passkeys }: { enabled: boolean; passkeys: number }) {
  const [state, formAction, pending] = useActionState(setPasswordLogin, initialState)
  useResultToast(state)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  let status = 'You can sign in with your password.'
  let buttonText = 'Turn off'
  let buttonClass = 'button-secondary'
  if (!enabled) {
    status = 'Password sign-in is off. You sign in with a passkey only.'
    buttonText = 'Turn on'
    buttonClass = 'button-primary'
  }
  if (pending) {
    buttonText = 'Saving…'
  }

  const blocked = enabled && passkeys === 0

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      <p className="card-status">{status}</p>
      {blocked && <p className="manage-empty">Add a passkey first. Without one you couldn&apos;t sign in anymore.</p>}
      {!blocked && (
        <>
          {!enabled && <input type="hidden" name="enabled" value="on" />}
          <label>
            <span>Current password</span>
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <div className="form-actions">
            <button type="submit" className={buttonClass} disabled={pending}>
              {buttonText}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
