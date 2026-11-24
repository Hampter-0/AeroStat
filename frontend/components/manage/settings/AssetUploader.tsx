'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { removeAsset, uploadAsset } from '@/app/manage/(panel)/settings/actions'
import { useResultToast } from '@/components/manage/toast/Toasts'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function AssetUploader({
  name,
  label,
  hint,
  previewUrl,
  isCustom,
}: {
  name: string
  label: string
  hint: string
  previewUrl: string | null
  isCustom: boolean
}) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadAsset, initialState)
  useResultToast(uploadState)
  const { formRef: uploadFormRef, onSubmit: uploadSubmit } = useFormSubmit(uploadAction, uploadState)
  const [removeState, removeAction, removing] = useActionState(removeAsset, initialState)
  useResultToast(removeState)

  let uploadText = 'Upload'
  if (uploading) {
    uploadText = 'Uploading…'
  }

  let statusText = 'Using the default'
  if (isCustom) {
    statusText = 'Custom file'
  }

  return (
    <div className="asset-uploader">
      <div className="asset-preview">
        {previewUrl && <img src={previewUrl} alt={label + ' preview'} />}
        {!previewUrl && <span>Default</span>}
      </div>
      <div className="asset-body">
        <strong>{label}</strong>
        <small>
          {statusText}, {hint}
        </small>
        <form ref={uploadFormRef} action={uploadAction} onSubmit={uploadSubmit} className="asset-form">
          <input type="hidden" name="name" value={name} />
          <input type="file" name="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif,image/x-icon,.ico" required />
          <button type="submit" className="button-secondary" disabled={uploading}>
            {uploadText}
          </button>
        </form>
        {isCustom && (
          <form action={removeAction}>
            <input type="hidden" name="name" value={name} />
            <button type="submit" className="link-button danger" disabled={removing}>
              Remove and use the default
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
