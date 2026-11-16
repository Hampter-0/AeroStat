import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import ForgotPasswordForm from '@/components/manage/ForgotPasswordForm'
import LoginHeading from '@/components/manage/LoginHeading'
import LoginShell from '@/components/manage/LoginShell'
import { getCurrentUser, manageFetch } from '@/lib/manage'

export const metadata = {
  title: 'Forgot password',
}

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser()
  if (user) {
    redirect('/manage')
  }

  let available = false
  try {
    const options = await manageFetch<{ password_reset: boolean }>('/login/options')
    available = options.password_reset
  } catch {
    available = false
  }

  return (
    <LoginShell>
      <LoginHeading title="Forgot password" subtitle="We email you a link to choose a new one" />
      <div className="manage-login-card">
        {available && <ForgotPasswordForm />}
        {!available && (
          <div className="manage-form">
            <p className="login-notice">
              Resetting by email is not set up on this server. Ask an admin to set a new password for you.
            </p>
            <Link href="/manage/login" className="login-back">
              <ChevronLeft /> Back to sign in
            </Link>
          </div>
        )}
      </div>
    </LoginShell>
  )
}
