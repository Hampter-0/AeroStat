'use client'

import { startRegistration, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import { useRouter } from 'next/navigation'
import { useActionState, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { finishPasskey, removePasskey, startPasskey } from '@/app/manage/(panel)/profile/passkey-actions'
import { Key } from '@/components/icons'
import { useConfirmedSubmit } from '@/components/manage/confirm/Confirm'
import { useErrorToast, useResultToast, useToast } from '@/components/manage/toast/Toasts'
import { browserError, type PasskeyInfo } from '@/lib/passkeys'

const initialState: FormState = { error: null, success: null }

export interface PasskeyRow extends PasskeyInfo {
  addedText: string
  usedText: string
}

function RemoveButton({ id, name }: { id: number; name: string }) {
  const [state, formAction, pending] = useActionState(removePasskey, initialState)
  useResultToast(state)

  const confirmRemove = useConfirmedSubmit(formAction, {
    title: 'Remove the passkey "' + name + '"?',
    message: 'You can no longer sign in with it.',
    confirmText: 'Remove',
    danger: true,
  })

  return (
    <form action={formAction} onSubmit={confirmRemove} className="passkey-remove">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="link-button danger" disabled={pending}>
        Remove
      </button>
    </form>
  )
}

export default function SecurityKeys({ passkeys, available }: { passkeys: PasskeyRow[]; available: boolean }) {
  const router = useRouter()
  const showToast = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [discoverable, setDiscoverable] = useState(true)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useErrorToast(error)

  function open() {
    setAdding(true)
    setError(null)
  }

  function close() {
    setAdding(false)
    setName('')
    setPassword('')
    setError(null)
  }

  function changeName(event: React.ChangeEvent<HTMLInputElement>) {
    setName(event.target.value)
  }

  function changePassword(event: React.ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value)
  }

  function changeDiscoverable(event: React.ChangeEvent<HTMLInputElement>) {
    setDiscoverable(event.target.checked)
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const started = await startPasskey(name, discoverable, password)
    if (started.error || !started.data) {
      setError(started.error)
      setBusy(false)
      return
    }
    const options = started.data as { publicKey: PublicKeyCredentialCreationOptionsJSON }
    let credential = null
    try {
      credential = await startRegistration({ optionsJSON: options.publicKey })
    } catch (failure) {
      setError(browserError(failure))
      setBusy(false)
      return
    }
    const finished = await finishPasskey(credential)
    setBusy(false)
    if (finished.error) {
      setError(finished.error)
      return
    }
    showToast('Passkey added')
    close()
    router.refresh()
  }

  if (!available) {
    return <p className="manage-empty">Passkeys need the status page address. An admin can set it under Settings → General.</p>
  }

  let createText = 'Create'
  if (busy) {
    createText = 'Waiting for your device…'
  }

  return (
    <div className="security-keys">
      {passkeys.length === 0 && <p className="manage-empty">No passkeys yet. Sign in with Windows Hello, Face ID, Touch ID, your phone or a security key instead of a password. Your device checks it is you; AeroStat never sees your face or fingerprint.</p>}
      {passkeys.length > 0 && (
        <ul className="passkey-list">
          {passkeys.map(function (passkey) {
            return (
              <li key={passkey.id}>
                <span className="passkey-icon">
                  <Key />
                </span>
                <span className="passkey-text">
                  <strong>{passkey.name}</strong>
                  <small>
                    {passkey.addedText}, {passkey.usedText}
                    {passkey.discoverable && ', without username'}
                  </small>
                </span>
                <RemoveButton id={passkey.id} name={passkey.name} />
              </li>
            )
          })}
        </ul>
      )}

      {!adding && (
        <div className="form-actions">
          <button type="button" className="button-secondary" onClick={open}>
            Add passkey
          </button>
        </div>
      )}

      {adding && (
        <form onSubmit={create} className="manage-form passkey-form">
          <label>
            <span>Name</span>
            <input value={name} onChange={changeName} required maxLength={60} placeholder="Laptop, phone, YubiKey…" autoFocus />
          </label>
          <label className="check-row hint-row">
            <input type="checkbox" checked={discoverable} onChange={changeDiscoverable} />
            <span>
              <strong>Allow signing in without a username</strong>
              <small>Saves the passkey on the device so you can pick it from a list. Some hardware keys have little room and may refuse; turn this off then.</small>
            </span>
          </label>
          <label>
            <span>Current password</span>
            <input type="password" value={password} onChange={changePassword} required autoComplete="current-password" />
          </label>
          <div className="form-actions passkey-actions">
            <button type="button" className="button-secondary" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="button-primary" disabled={busy}>
              {createText}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
