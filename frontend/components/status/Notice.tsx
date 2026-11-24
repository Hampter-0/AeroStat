import type { ReactNode } from 'react'
import { Arrow } from '@/components/icons'

export default function Notice({
  tone,
  icon,
  title,
  text,
  href,
}: {
  tone: string
  icon: ReactNode
  title: string
  text: ReactNode
  href?: string
}) {
  return (
    <section className={'notice tone-' + tone}>
      <span className="notice-icon tone-icon">{icon}</span>
      <div className="notice-copy">
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {href && (
        <a className="text-button" href={href}>
          View details <Arrow />
        </a>
      )}
    </section>
  )
}
