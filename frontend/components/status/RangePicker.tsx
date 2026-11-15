import Link from 'next/link'
import { ChevronLeft, ChevronRight } from '@/components/icons'

export default function RangePicker({
  label,
  previousHref,
  nextHref,
}: {
  label: string
  previousHref: string | null
  nextHref: string | null
}) {
  let previous = (
    <span className="range-button disabled" aria-hidden="true">
      <ChevronLeft />
    </span>
  )
  if (previousHref) {
    previous = (
      <Link href={previousHref} className="range-button" aria-label="Previous months" scroll={false}>
        <ChevronLeft />
      </Link>
    )
  }

  let next = (
    <span className="range-button disabled" aria-hidden="true">
      <ChevronRight />
    </span>
  )
  if (nextHref) {
    next = (
      <Link href={nextHref} className="range-button" aria-label="Next months" scroll={false}>
        <ChevronRight />
      </Link>
    )
  }

  return (
    <nav className="range-picker" aria-label="Months">
      {previous}
      <span>{label}</span>
      {next}
    </nav>
  )
}
