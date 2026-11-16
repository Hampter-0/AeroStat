'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { login, type LoginState } from '@/app/manage/actions'
import { ChevronLeft, Lock, User } from '@/components/icons'
import LoginHeading from '@/components/manage/LoginHeading'
import PasskeyLoginButton from '@/components/manage/PasskeyLoginButton'
import TwoFactorStep from '@/components/manage/TwoFactorStep'
import { useKeepValuesSubmit } from '@/lib/use-form-submit'

const initialState: LoginState = { error: null, success: null, twoFactor: null }

export default function LoginForm({ passkeys, passwordReset }: { passkeys: boolean; passwordReset: boolean }) {
  const [state, formAction, pending] = useActionState(login, initialState)
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
          title="Welcome back"
          subtitle={
            <>
              Enter the password for <strong>{username}</strong>
            </>
          }
        />
        <div className="manage-login-card">
          <form action={formAction} onSubmit={onSubmit} className="manage-form">
            <input type="hidden" name="username" value={username} autoComplete="username" />
            <label>
              <span className="label-row">
                Password
                {passwordReset && (
                  <Link href="/manage/forgot-password" className="link-button">
                    Forgot password?
                  </Link>
                )}
              </span>
              <div className="input-with-icon">
                <Lock />
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  ref={passwordRef}
                  required
                  autoFocus
                />
              </div>
            </label>
            {state.error && <p className="form-error" role="alert">{state.error}</p>}
            <button type="submit" className="button-primary" disabled={pending}>
              {buttonText}
            </button>
            <button type="button" className="login-back" onClick={back}>
              <ChevronLeft /> Use another account
            </button>
          </form>
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
