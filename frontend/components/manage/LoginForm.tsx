'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { login, type LoginState } from '@/app/manage/actions'
import { User } from '@/components/icons'
import LoginHeading from '@/components/manage/LoginHeading'
import PasskeyLoginButton from '@/components/manage/PasskeyLoginButton'
import PasswordInput from '@/components/manage/PasswordInput'
import TwoFactorStep from '@/components/manage/TwoFactorStep'
import { useKeepValuesSubmit } from '@/lib/use-form-submit'
import { useResultToast } from '@/components/manage/toast/Toasts'

const initialState: LoginState = { error: null, success: null, twoFactor: null }

export default function LoginForm({ passkeys, passwordReset }: { passkeys: boolean; passwordReset: boolean }) {
  const [state, formAction, pending] = useActionState(login, initialState)
  useResultToast(state)
  const onSubmit = useKeepValuesSubmit(formAction)
  const [step, setStep] = useState('name')
  const [username, setUsername] = useState('')
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(
    function () {
      if (state.error && passwordRef.current) {
        passwordRef.current.value = ''
        passwordRef.current.focus()
      }
    },
    [state],
  )

  function changeUsername(event: React.ChangeEvent<HTMLInputElement>) {
    setUsername(event.target.value)
  }

  function next(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (username.trim() === '') {
      return
    }
    setUsername(username.trim())
    setStep('password')
  }

  function back() {
    setStep('name')
  }

  if (state.twoFactor) {
    return (
      <>
        <LoginHeading
          title="Two-factor sign-in"
          subtitle={
            <>
              One more step to sign in as <strong>{username}</strong>
            </>
          }
        />
        <div className="manage-login-card">
          <TwoFactorStep challenge={state.twoFactor} />
        </div>
      </>
    )
  }

  if (step === 'password') {
    let buttonText = 'Sign in'
    if (pending) {
      buttonText = 'Signing in…'
    }
    return (
      <>
        <LoginHeading
          title="Enter password"
          subtitle={
            <>
              Please enter your password for <strong>{username}</strong>
            </>
          }
        />
        <div className="manage-login-card">
          <form action={formAction} onSubmit={onSubmit} className="manage-form">
            <input type="hidden" name="username" value={username} autoComplete="username" />
            <label>
              <span>Password</span>
              <PasswordInput
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                inputRef={passwordRef}
                autoFocus
              />
            </label>
            <button type="submit" className="button-primary" disabled={pending}>
              {buttonText}
            </button>
          </form>
          <div className="passkey-login">
            <div className="login-divider">
              <span>or</span>
            </div>
            {passwordReset && (
              <Link href="/manage/forgot-password" className="button-soft">
                Forgot password
              </Link>
            )}
            <button type="button" className="button-soft" onClick={back}>
              Back
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <LoginHeading title="Login" subtitle="Enter your username or email to continue" />
      <div className="manage-login-card">
        <form onSubmit={next} className="manage-form">
          <label>
            <span>Username or email</span>
            <div className="input-with-icon">
              <User />
              <input
                name="username"
                autoComplete="username"
                placeholder="Enter your username or email"
                value={username}
                onChange={changeUsername}
                required
                autoFocus
              />
            </div>
          </label>
          <button type="submit" className="button-primary">
            Continue
          </button>
        </form>
        {passkeys && <PasskeyLoginButton />}
      </div>
    </>
  )
}
