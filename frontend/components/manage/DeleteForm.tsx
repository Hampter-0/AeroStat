'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { useConfirmedSubmit } from '@/components/manage/confirm/Confirm'
import { useResultToast } from '@/components/manage/toast/Toasts'

const initialState: FormState = { error: null, success: null }

export default function DeleteForm({
  id,
  action,
  buttonText,
  description,
  confirmText,
}: {
  id: number | string
  action: (state: FormState, formData: FormData) => Promise<FormState>
  buttonText: string
  description: string
  confirmText: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  useResultToast(state)

  let title = confirmText
  let message: string | undefined = undefined
  const split = confirmText.indexOf('? ')
  if (split > 0) {
    title = confirmText.slice(0, split + 1)
    message = confirmText.slice(split + 2)
  }
  const confirmDelete = useConfirmedSubmit(formAction, {
    title: title,
    message: message,
    confirmText: buttonText,
    danger: true,
  })

  return (
    <form action={formAction} onSubmit={confirmDelete} className="danger-zone">
      <input type="hidden" name="id" value={id} />
      <p>{description}</p>
      <button type="submit" className="button-danger" disabled={pending}>
        {buttonText}
      </button>
    </form>
  )
}
