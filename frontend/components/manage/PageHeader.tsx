import type { ReactNode } from 'react'

export default function PageHeader({
  title,
  description,
  badge,
  action,
  variant,
}: {
  title: ReactNode
  description?: ReactNode
  badge?: ReactNode
  action?: ReactNode
  variant?: string
}) {
  if (action === undefined) {
    return (
      <header className="manage-page-header">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </header>
    )
  }

  let className = 'manage-page-header with-action'
  if (variant) {
    className = 'manage-page-header ' + variant
  }
  return (
    <header className={className}>
      <div>
        {badge}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  )
}
