import type { ReactNode } from 'react'

export default function StateBadge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={'state-badge tone-' + tone}>{children}</span>
}
