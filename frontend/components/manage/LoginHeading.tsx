import type { ReactNode } from 'react'

export default function LoginHeading({ title, subtitle }: { title: string; subtitle: ReactNode }) {
  return (
    <div className="manage-login-heading">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  )
}
