'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  confirmApp,
  confirmEmail,
  disableApp,
  disableEmail,
  newRecoveryCodes,
  startApp,
  startEmail,
} from '@/app/manage/(panel)/profile/two-factor-actions'
import { useErrorToast, useToast } from '@/components/manage/toast/Toasts'
import type { TwoFactorStatus } from '@/lib/two-factor'

type Step =
  | 'idle'
  | 'app-password'
  | 'app-scan'
  | 'app-off'
  | 'email-password'
  | 'email-code'
  | 'email-off'
  | 'codes-password'
  | 'codes'

export default function TwoFactorCard({ status }: { status: TwoFactorStatus }) {
  const router = useRouter()
  const showToast = useToast()
  const [step, setStep] = useState<Step>('idle')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [codes, setCodes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useErrorToast(error)

  function go(next: Step) {
    setStep(next)
    setPassword('')
    setCode('')
    setError(null)
  }

  function cancel() {
    go('idle')
    setQr(null)
    setSecret(null)
  }

  function changePassword(event: React.ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value)
  }

  function changeCode(event: React.ChangeEvent<HTMLInputElement>) {
    setCode(event.target.value)
  }

  function finish(message: string, recovery: string[] | null) {
    showToast(message)
    router.refresh()
    if (recovery && recovery.length > 0) {
      setCodes(recovery)
      go('codes')
    } else {
      cancel()
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    if (step === 'app-password') {
      const result = await startApp(password)
      if (result.error || !result.data) {
        setError(result.error)
      } else {
        setQr(result.data.qr)
        setSecret(result.data.secret)
        go('app-scan')
      }
    } else if (step === 'app-scan') {
      const result = await confirmApp(code)
      if (result.error || !result.data) {
        setError(result.error)
      } else {
        setQr(null)
        setSecret(null)
        finish('Authenticator app turned on', result.data.recovery_codes)
      }
    } else if (step === 'app-off') {
      const result = await disableApp(password)
      if (result.error) {
        setError(result.error)
      } else {
        finish('Authenticator app turned off', null)
      }
    } else if (step === 'email-password') {
      const result = await startEmail(password)
      if (result.error) {
        setError(result.error)
      } else {
        go('email-code')
      }
    } else if (step === 'email-code') {
      const result = await confirmEmail(code)
      if (result.error || !result.data) {
        setError(result.error)
      } else {
        finish('Email codes turned on', result.data.recovery_codes)
      }
    } else if (step === 'email-off') {
      const result = await disableEmail(password)
      if (result.error) {
        setError(result.error)
      } else {
        finish('Email codes turned off', null)
      }
    } else if (step === 'codes-password') {
      const result = await newRecoveryCodes(password)
      if (result.error || !result.data) {
        setError(result.error)
      } else {
        finish('New recovery codes made', result.data.recovery_codes)
      }
    }
    setBusy(false)
  }

  function copyCodes() {
    navigator.clipboard.writeText(codes.join('\n'))
    showToast('Recovery codes copied')
  }

  function downloadCodes() {
    const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function doneWithCodes() {
    setCodes([])
    go('idle')
  }

  if (step === 'codes') {
    return (
      <div className="manage-form">
        <p className="card-status">
          Save these recovery codes somewhere safe. Each one signs you in once when you can&apos;t use your app or email. You
          won&apos;t see them again.
        </p>
        <ul className="recovery-codes">
          {codes.map(function (value) {
            return <li key={value}>{value}</li>
          })}
        </ul>
        <div className="form-actions">
          <button type="button" className="button-secondary" onClick={copyCodes}>
            Copy
          </button>
          <button type="button" className="button-secondary" onClick={downloadCodes}>
            Download
          </button>
          <button type="button" className="button-primary" onClick={doneWithCodes}>
            I saved them
          </button>
        </div>
      </div>
    )
  }

  let buttonText = 'Continue'
  if (busy) {
    buttonText = 'Working…'
  }

  if (step !== 'idle') {
    let intro = ''
    let askPassword = true
    let askCode = false
    let danger = false
    if (step === 'app-password') {
      intro = 'Confirm your password to link an authenticator app, like 1Password, Bitwarden, Google Authenticator or Aegis.'
    } else if (step === 'app-scan') {
      intro = 'Scan the QR code with your app, or type the key by hand. Then enter the 6-digit code the app shows.'
      askPassword = false
      askCode = true
    } else if (step === 'app-off') {
      intro = 'Confirm your password to stop asking for app codes.'
      danger = true
    } else if (step === 'email-password') {
      intro = 'Confirm your password. We then send a code to ' + status.email_address + ' to check it arrives.'
    } else if (step === 'email-code') {
      intro = 'Enter the 6-digit code we sent to ' + status.email_address + '. It works for 5 minutes.'
      askPassword = false
      askCode = true
    } else if (step === 'email-off') {
      intro = 'Confirm your password to stop sending sign-in codes by email.'
      danger = true
    } else if (step === 'codes-password') {
      intro = 'Confirm your password to make 10 new recovery codes. Your old codes stop working.'
    }

    let buttonClass = 'button-primary'
    if (danger) {
      buttonClass = 'button-danger'
    }

    return (
      <form onSubmit={submit} className="manage-form">
        <p className="card-status">{intro}</p>
        {step === 'app-scan' && qr && (
          <div className="two-factor-qr">
            <img src={'data:image/png;base64,' + qr} alt="QR code for your authenticator app" width={180} height={180} />
            {secret && <code className="two-factor-secret">{secret}</code>}
          </div>
        )}
        {askPassword && (
          <label>
            <span>Current password</span>
            <input
              type="password"
              value={password}
              onChange={changePassword}
              required
              autoFocus
              autoComplete="current-password"
            />
          </label>
        )}
        {askCode && (
          <label>
            <span>Code</span>
            <input
              value={code}
              onChange={changeCode}
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
            />
          </label>
        )}
        <div className="form-actions">
          <button type="button" className="button-secondary" onClick={cancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={buttonClass} disabled={busy}>
            {buttonText}
          </button>
        </div>
      </form>
    )
  }

  const anyOn = status.app || status.email

  let appText = 'Off'
  if (status.app) {
    appText = 'On'
  } else if (!status.app_available) {
    appText = 'Not set up on this server'
  }

  let emailText = 'Off'
  if (status.email) {
    emailText = 'On'
  } else if (!status.email_available) {
    emailText = 'Email is not set up on this server'
  } else if (!status.email_address) {
    emailText = 'Add an email address first'
  }

  let summary = 'Ask for a code after your password, from an app or by email.'
  if (anyOn) {
    summary = 'You need a code after your password to sign in.'
  }

  let codesText = status.recovery_codes_left + ' recovery codes left'
  if (status.recovery_codes_left === 1) {
    codesText = '1 recovery code left'
  }

  function openAppOn() {
    go('app-password')
  }

  function openAppOff() {
    go('app-off')
  }

  function openEmailOn() {
    go('email-password')
  }

  function openEmailOff() {
    go('email-off')
  }

  function openCodes() {
    go('codes-password')
  }

  return (
    <div className="manage-form">
      <p className="card-status">{summary}</p>
      <ul className="passkey-list">
        <li>
          <span className="passkey-text">
            <strong>Authenticator app</strong>
            <small>{appText}</small>
          </span>
          {status.app && (
            <button type="button" className="link-button danger" onClick={openAppOff}>
              Turn off
            </button>
          )}
          {!status.app && status.app_available && (
            <button type="button" className="link-button" onClick={openAppOn}>
              Set up
            </button>
          )}
        </li>
        <li>
          <span className="passkey-text">
            <strong>Email codes</strong>
            <small>{emailText}</small>
          </span>
          {status.email && (
            <button type="button" className="link-button danger" onClick={openEmailOff}>
              Turn off
            </button>
          )}
          {!status.email && status.email_available && status.email_address && (
            <button type="button" className="link-button" onClick={openEmailOn}>
              Set up
            </button>
          )}
        </li>
        {anyOn && (
          <li>
            <span className="passkey-text">
              <strong>Recovery codes</strong>
              <small>{codesText}</small>
            </span>
            <button type="button" className="link-button" onClick={openCodes}>
              New codes
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}
