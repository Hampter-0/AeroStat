'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { restoreBackup } from '@/app/manage/(panel)/system/backup-restore-action'
import PasswordInput from '@/components/manage/PasswordInput'
import { useToast } from '@/components/manage/toast/Toasts'
import type { Backup } from '@/lib/backups'

const FIRST_CHECK_MS = 4000
const CHECK_EVERY_MS = 2000

function RestartingScreen() {
  const router = useRouter()
  const [waited, setWaited] = useState(0)

  useEffect(
    function () {
      let stopped = false
      const started = Date.now()

      async function check() {
        if (stopped) {
          return
        }
        setWaited(Math.round((Date.now() - started) / 1000))
        let ready = false
        try {
          const res = await fetch('/manage/backups/ready', {
            cache: 'no-store',
          })
          ready = res.ok
        } catch {
          ready = false
        }
        if (ready) {
          router.push('/manage/login')
          return
        }
        window.setTimeout(check, CHECK_EVERY_MS)
      }

      const timer = window.setTimeout(check, FIRST_CHECK_MS)
      return function () {
        stopped = true
        window.clearTimeout(timer)
      }
    },
    [router],
  )

  let note = 'This takes a few seconds. You are taken to the sign-in page when it is back.'
  if (waited > 60) {
    note = 'This takes longer than usual. Check the backend with docker compose logs backend.'
  }

  return (
    <div className="restore-screen" role="status" aria-live="polite">
      <div className="restore-screen-card">
        <span className="restore-spinner" aria-hidden="true" />
        <h2>Backup restored, AeroStat is restarting</h2>
        <p>{note}</p>
        <p className="field-hint">Your session belonged to the old data, so you sign in again.</p>
      </div>
    </div>
  )
}

export default function RestoreBackup({ backup, label }: { backup: Backup; label: string }) {
  const router = useRouter()
  const showToast = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(function () {
    window.setTimeout(function () {
      setMounted(true)
    }, 0)
  }, [])

  function open() {
    if (dialogRef.current) {
      dialogRef.current.showModal()
    }
  }

  function close() {
    if (dialogRef.current) {
      dialogRef.current.close()
    }
    if (passwordRef.current) {
      passwordRef.current.value = ''
    }
  }

  function onCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    if (busy) {
      event.preventDefault()
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let password = ''
    if (passwordRef.current) {
      password = passwordRef.current.value
    }
    setBusy(true)
    const result = await restoreBackup(backup.id, password)
    setBusy(false)
    if (result.error || !result.data) {
      showToast(result.error || 'The restore failed. Nothing was changed.', 'error')
      if (passwordRef.current) {
        passwordRef.current.value = ''
        passwordRef.current.focus()
      }
      return
    }
    close()
    if (result.data.restarting) {
      setRestarting(true)
      return
    }
    router.push('/manage/login')
  }

  let uploadedBy = 'someone'
  if (backup.created_by) {
    uploadedBy = backup.created_by
  }

  let buttonText = 'Restore backup'
  if (busy) {
    buttonText = 'Restoring…'
  }

  return (
    <>
      <button type="button" className="link-button" onClick={open}>
        Restore
      </button>
      {mounted &&
        createPortal(
          <dialog ref={dialogRef} className="confirm-dialog" onCancel={onCancel}>
            <form className="confirm-body manage-form" onSubmit={submit}>
              <h2>Restore the backup from {label}?</h2>
              <p>
                Everything in the database is replaced with this backup (v
                {backup.version}). Anything that changed after it is gone, including users, sessions, incidents and
                check history. A backup of the database as it is now is made first.
              </p>
              {backup.kind === 'upload' && (
                <p className="restore-warning">
                  This backup was uploaded by {uploadedBy}, it was not made on this server. A backup runs as SQL on your
                  database: only restore it if you trust where it came from.
                </p>
              )}
              <label>
                <span>Your current password</span>
                <PasswordInput
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  inputRef={passwordRef}
                />
              </label>
              <div className="form-actions">
                <button type="button" className="button-secondary" onClick={close} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="button-danger" disabled={busy}>
                  {buttonText}
                </button>
              </div>
            </form>
          </dialog>,
          document.body,
        )}
      {restarting && mounted && createPortal(<RestartingScreen />, document.body)}
    </>
  )
}
