'use client'

import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { useState } from 'react'
import { finishPasskeyLogin, startPasskeyLogin } from '@/app/manage/passkey-login'
import { Key } from '@/components/icons'
import { browserError } from '@/lib/passkeys'
import { useErrorToast } from '@/components/manage/toast/Toasts'

export default function PasskeyLoginButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useErrorToast(error)

  async function signIn() {
    setBusy(true)
    setError(null)
    const started = await startPasskeyLogin()
    if (started.error || !started.data) {
      setError(started.error)
      setBusy(false)
      return
    }
    const options = started.data.options as { publicKey: PublicKeyCredentialRequestOptionsJSON }
    let credential = null
    try {
      credential = await startAuthentication({ optionsJSON: options.publicKey })
    } catch (failure) {
      setError(browserError(failure))
      setBusy(false)
      return
    }
    const finished = await finishPasskeyLogin(started.data.challenge_id, credential)
    if (finished && finished.error) {
      setError(finished.error)
      setBusy(false)
    }
  }

  let label = 'Sign in with a passkey'
  if (busy) {
    label = 'Waiting for your device…'
  }

  return (
    <div className="passkey-login">
      <div className="login-divider">
        <span>or</span>
      </div>
      <button type="button" className="button-passkey" onClick={signIn} disabled={busy}>
        <Key /> {label}
      </button>
    </div>
  )
}
