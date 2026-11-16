import type { Metadata } from 'next'
import Link from 'next/link'
import LoginBackLink from '@/components/manage/LoginBackLink'
import LoginHeading from '@/components/manage/LoginHeading'
import LoginShell from '@/components/manage/LoginShell'
import ResetPasswordForm from '@/components/manage/ResetPasswordForm'
import { manageFetch } from '@/lib/manage'

export const metadata: Metadata = {
  title: 'Reset password',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  let valid = false
  if (token) {
    try {
      const check = await manageFetch<{ valid: boolean }>('/password-reset/check?token=' + encodeURIComponent(token))
      valid = check.valid
    } catch {
      valid = false
    }
  }

  return (
    <LoginShell>
      <LoginHeading title="Choose a new password" subtitle="Pick one you don’t use anywhere else" />
      <div className="manage-login-card">
        {valid && token && <ResetPasswordForm token={token} />}
        {!valid && (
          <div className="manage-form">
            <p className="form-error" role="alert">
              This link has expired or was already used. Links work once, for 30 minutes.
            </p>
            <Link href="/manage/forgot-password" className="button-primary login-button-link">
              Send a new link
            </Link>
          </div>
        )}
        {!valid && <LoginBackLink label="Login" />}
      </div>
    </LoginShell>
  )
}
