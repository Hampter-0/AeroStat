import { redirect } from 'next/navigation'
import LoginForm from '@/components/manage/LoginForm'
import LoginShell from '@/components/manage/LoginShell'
import { getCurrentUser, manageFetch } from '@/lib/manage'

export const metadata = {
  title: 'Login',
}

interface LoginOptions {
  passkeys: boolean
  password_reset: boolean
}

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) {
    redirect('/manage')
  }

  let options: LoginOptions = { passkeys: false, password_reset: false }
  try {
    options = await manageFetch<LoginOptions>('/login/options')
  } catch {
    console.error('Could not load the sign-in options; showing password sign-in only')
  }

  return (
    <LoginShell>
      <LoginForm passkeys={options.passkeys} passwordReset={options.password_reset} />
    </LoginShell>
  )
}
