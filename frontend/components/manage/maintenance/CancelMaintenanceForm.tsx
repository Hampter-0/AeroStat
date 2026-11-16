'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { cancelMaintenance, reactivateMaintenance } from '@/app/manage/(panel)/maintenance/actions'
import { useFormSubmit } from '@/lib/use-form-submit'
import { useResultToast } from '@/components/manage/toast/Toasts'

const initialState: FormState = { error: null, success: null }

export default function CancelMaintenanceForm({ id, cancelled }: { id: number; cancelled: boolean }) {
  const [cancelState, cancelAction, cancelling] = useActionState(cancelMaintenance, initialState)
  useResultToast(cancelState)
  const [reactivateState, reactivateAction, reactivating] = useActionState(reactivateMaintenance, initialState)
  useResultToast(reactivateState)

  const { formRef: cancelFormRef, onSubmit: cancelSubmit } = useFormSubmit(cancelAction, cancelState, {
    title: 'Cancel this maintenance?',
    message: 'Visitors will see it as cancelled.',
    confirmText: 'Cancel maintenance',
    danger: true,
  })

  if (cancelled) {
    return (
      <form action={reactivateAction} className="danger-zone">
        <input type="hidden" name="id" value={id} />
        <p>This maintenance is cancelled. Reactivate it to show it as planned again.</p>
        <button type="submit" className="button-secondary" disabled={reactivating}>
          Reactivate
        </button>
      </form>
    )
  }

  return (
    <form ref={cancelFormRef} action={cancelAction} onSubmit={cancelSubmit} className="manage-form">
      <input type="hidden" name="id" value={id} />
      <label>
        <span>Reason</span>
        <textarea name="message" rows={2} placeholder="Optional. Defaults to “This maintenance has been cancelled.”" />
      </label>
      <div className="form-actions">
        <button type="submit" className="button-danger" disabled={cancelling}>
          Cancel maintenance
        </button>
      </div>
    </form>
  )
}
