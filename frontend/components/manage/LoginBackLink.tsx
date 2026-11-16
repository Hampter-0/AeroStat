import Link from 'next/link'

export default function LoginBackLink({ label }: { label: string }) {
  return (
    <div className="passkey-login">
      <div className="login-divider">
        <span>or</span>
      </div>
      <Link href="/manage/login" className="button-soft">
        {label}
      </Link>
    </div>
  )
}
