'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { checkForUpdates } from '@/app/manage/(panel)/settings/actions'
import CopyButton from '@/components/manage/CopyButton'
import { UPDATE_COMMAND } from '@/lib/update-command'
import type { VersionInfo } from '@/lib/version'
import { useResultToast } from '@/components/manage/toast/Toasts'

const initialState: FormState = { error: null, success: null }

export default function UpdateCheck({ version, checkedText }: { version: VersionInfo; checkedText: string }) {
  const [state, formAction, pending] = useActionState(checkForUpdates, initialState)
  useResultToast(state)

  let statusText = 'Not checked yet'
  if (version.check_error) {
    statusText = version.check_error
  } else if (version.update_available) {
    statusText = 'v' + version.latest + ' is available'
  } else if (version.checked_at) {
    statusText = 'You are on the latest version'
  }

  let buttonText = 'Check for updates'
  if (pending) {
    buttonText = 'Checking…'
  }

  return (
    <form action={formAction} className="update-check">
      <div className="update-check-info">
        <strong>AeroStat v{version.current}</strong>
        <span>
          {statusText}
          {checkedText && ' · checked ' + checkedText}
        </span>
        {version.update_available && version.release_url && (
          <a href={version.release_url} target="_blank" rel="noreferrer">
            See what&apos;s new in v{version.latest}
          </a>
        )}
      </div>
      <div className="update-check-actions">
        {version.update_available && <CopyButton text={UPDATE_COMMAND} label="Copy update command" />}
        <button type="submit" className="button-secondary" disabled={pending}>
          {buttonText}
        </button>
      </div>
    </form>
  )
}
