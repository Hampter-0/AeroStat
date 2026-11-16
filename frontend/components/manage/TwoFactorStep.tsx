'use client'

import { useEffect, useRef, useState } from 'react'
import { sendLoginCode, verifyLoginCode } from '@/app/manage/two-factor-login'
import type { TwoFactorChallenge } from '@/lib/two-factor'

export default function TwoFactorStep({ challenge }: { challenge: TwoFactorChallenge }) {
  let firstMode = 'email'
  if (challenge.methods.includes('app')) {
    firstMode = 'app'
  }
  const [mode, setMode] = useState(firstMode)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const sentOnce = useRef(false)

  let hint = 'your email address'
  if (challenge.email_hint) {
    hint = challenge.email_hint
  }

  async function sendCode() {
    setError(null)
    const result = await sendLoginCode(challenge.challenge_id)
    if (result.error) {
      setError(result.error)
      return
    }
    setNotice('We sent a code to ' + hint + '. It works for 5 minutes.')
  }

  useEffect(
    function () {
      if (firstMode !== 'email' || sentOnce.current) {
        return
      }
      sentOnce.current = true
      sendLoginCode(challenge.challenge_id).then(function (result) {
        if (result.error) {
          setError(result.error)
        } else {
          setNotice('We sent a code to ' + hint + '. It works for 5 minutes.')
        }
      })
    },
    [firstMode, challenge.challenge_id, hint],
  )

  function changeCode(event: React.ChangeEvent<HTMLInputElement>) {
    setCode(event.target.value)
  }

  function useEmail() {
    setMode('email')
    setCode('')
    sendCode()
  }

  function useRecovery() {
    setMode('recovery')
    setCode('')
    setNotice(null)
    setError(null)
  }

  function useApp() {
    setMode('app')
    setCode('')
    setNotice(null)
    setError(null)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result = await verifyLoginCode(challenge.challenge_id, code)
    if (result && result.error) {
      setError(result.error)
      setBusy(false)
    }
  }

  let title = 'Enter the 6-digit code from your authenticator app.'
  let placeholder = '123456'
  let inputMode: 'numeric' | 'text' = 'numeric'
  if (mode === 'email') {
    title = 'Enter the 6-digit code we emailed to ' + hint + '.'
  } else if (mode === 'recovery') {
    title = 'Enter one of your recovery codes. Each one works once.'
    placeholder = 'abcde-fghjk-mnpqr'
    inputMode = 'text'
  }

  let buttonText = 'Verify'
  if (busy) {
    buttonText = 'Checking…'
  }

  return (
    <form onSubmit={submit} className="manage-form two-factor-step">
      <p className="two-factor-title">{title}</p>
      {notice && mode === 'email' && <p className="field-hint">{notice}</p>}
      <label>
        <span>Code</span>
        <input
          value={code}
          onChange={changeCode}
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode={inputMode}
          placeholder={placeholder}
          maxLength={20}
        />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="button-primary" disabled={busy}>
        {buttonText}
      </button>
      <div className="two-factor-links">
        {mode !== 'app' && challenge.methods.includes('app') && (
          <button type="button" className="link-button" onClick={useApp}>
            Use the authenticator app
          </button>
        )}
        {mode !== 'email' && challenge.methods.includes('email') && (
          <button type="button" className="link-button" onClick={useEmail}>
            Email me a code instead
          </button>
        )}
        {mode === 'email' && (
          <button type="button" className="link-button" onClick={sendCode}>
            Send a new code
          </button>
        )}
        {mode !== 'recovery' && (
          <button type="button" className="link-button" onClick={useRecovery}>
            Use a recovery code
          </button>
        )}
        <a href="/manage/login" className="link-button">
          Back
        </a>
      </div>
    </form>
  )
}
