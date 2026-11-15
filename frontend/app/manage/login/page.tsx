import Link from 'next/link'
import { redirect } from 'next/navigation'
import Logo from '@/components/layout/Logo'
import LoginForm from '@/components/manage/LoginForm'
import { getSiteConfig } from '@/lib/branding'
import { getCurrentUser } from '@/lib/manage'

export const metadata = {
  title: 'Login',
}

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) {
    redirect('/manage')
  }

  const config = await getSiteConfig()
  const siteName = config.siteName
  const year = new Date().getUTCFullYear()

  return (
    <div className="manage-login">
      <div className="manage-login-inner">
        <div className="manage-login-brand">
          <Logo size={44} />
          <span>{siteName}</span>
        </div>

        <div className="manage-login-heading">
          <h1>Login</h1>
          <p>Enter your username and password to continue</p>
        </div>

        <div className="manage-login-card">
          <LoginForm />
        </div>

        <footer className="manage-login-footer">
          <Logo size={14} />
          <Link href="/">{siteName}</Link>
          <span>© {year}</span>
        </footer>
      </div>
    </div>
  )
}
