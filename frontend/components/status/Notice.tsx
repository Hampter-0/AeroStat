import Link from 'next/link'
import { ChevronRight } from '@/components/icons'
import StatusGlyph, { type GlyphKind } from '@/components/StatusGlyph'

export default function Notice({
  tone,
  kind,
  title,
  text,
  href,
}: {
  tone: string
  kind: GlyphKind
  title: string
  text: string
  href?: string
}) {
  const inner = (
    <>
      <span className="notice-icon">
        <StatusGlyph kind={kind} size={22} />
      </span>
      <span className="notice-copy">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
    </>
  )
  if (href) {
    return (
      <Link href={href} className={'notice tone-' + tone}>
        {inner}
        <span className="notice-arrow" aria-hidden="true">
          <ChevronRight />
        </span>
      </Link>
    )
  }
  return <section className={'notice tone-' + tone}>{inner}</section>
}
