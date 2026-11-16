'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { removeAvatar, uploadAvatar } from '@/app/manage/(panel)/profile/actions'
import Avatar from '@/components/manage/Avatar'
import { useResultToast } from '@/components/manage/toast/Toasts'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function AvatarForm({
  userId,
  username,
  version,
}: {
  userId: number
  username: string
  version: number | null
}) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadAvatar, initialState)
  useResultToast(uploadState)
  const { formRef: uploadFormRef, onSubmit: uploadSubmit } = useFormSubmit(uploadAction, uploadState)
  const [removeState, removeAction, removing] = useActionState(removeAvatar, initialState)
  useResultToast(removeState)

  let uploadText = 'Upload'
  if (uploading) {
    uploadText = 'Uploading…'
  }

  return (
    <div className="avatar-form">
      <Avatar userId={userId} username={username} version={version} size={72} />
      <div className="asset-body">
        <small>PNG, JPG, WebP or GIF, up to 1 MB. Square works best.</small>
        <form ref={uploadFormRef} action={uploadAction} onSubmit={uploadSubmit} className="asset-form">
          <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
          <button type="submit" className="button-secondary" disabled={uploading}>
            {uploadText}
          </button>
        </form>
        {version && (
          <form action={removeAction}>
            <button type="submit" className="link-button danger" disabled={removing}>
              Remove photo
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
