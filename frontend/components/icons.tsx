export function Check({ size }: { size?: number }) {
    var finalSize = size
    if (finalSize === undefined) {
        finalSize = 16
    }
    return (
        <svg width={finalSize} height={finalSize} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m5.5 10.2 2.8 2.8 6.2-6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

export function Calendar() {
    return (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="3" y="4.5" width="14" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6.5 2.8v3.4M13.5 2.8v3.4M3 8h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    )
}

export function Arrow() {
    return (
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

export function Chevron({ open }: { open: boolean }) {
    var className = 'chevron'
    if (open) {
        className = 'chevron open'
    }
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

export function X({ size }: { size?: number }) {
  var finalSize = size
  if (finalSize === undefined) {
    finalSize = 16
  }
  return (
    <svg width={finalSize} height={finalSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </svg>
  )
}

export function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m12.5 5-5 5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m7.5 5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PendingRing() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="17.5" cy="10" r="1.3" fill="currentColor" />
      <circle cx="16.07" cy="14.41" r="1.3" fill="currentColor" />
      <circle cx="12.32" cy="17.13" r="1.3" fill="currentColor" />
      <circle cx="7.68" cy="17.13" r="1.3" fill="currentColor" />
      <circle cx="3.93" cy="14.41" r="1.3" fill="currentColor" />
      <circle cx="2.5" cy="10" r="1.3" fill="currentColor" />
      <circle cx="3.93" cy="5.59" r="1.3" fill="currentColor" />
      <circle cx="7.68" cy="2.87" r="1.3" fill="currentColor" />
      <circle cx="12.32" cy="2.87" r="1.3" fill="currentColor" />
      <circle cx="16.07" cy="5.59" r="1.3" fill="currentColor" />
    </svg>
  )
}