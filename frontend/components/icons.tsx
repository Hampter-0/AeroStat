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

export function AlertTriangle({ size }: { size?: number }) {
  var finalSize = size
  if (finalSize === undefined) {
    finalSize = 18
  }
  return (
    <svg width={finalSize} height={finalSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" />
      <path d="M12 16h.01" />
    </svg>
  )
}

export function Tool({ size }: { size?: number }) {
  var finalSize = size
  if (finalSize === undefined) {
    finalSize = 18
  }
  return (
    <svg width={finalSize} height={finalSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5" />
    </svg>
  )
}

export function AlertSmall({ size }: { size?: number }) {
  var finalSize = size
  if (finalSize === undefined) {
    finalSize = 18
  }
  return (
    <svg width={finalSize} height={finalSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  )
}
export function Monitor() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 17h6M10 13.5V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function Sun() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2v1.8M10 16.2V18M2 10h1.8M16.2 10H18M4.3 4.3l1.3 1.3M14.4 14.4l1.3 1.3M4.3 15.7l1.3-1.3M14.4 5.6l1.3-1.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function Moon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M16.5 12.3A6.8 6.8 0 0 1 7.7 3.5a6.8 6.8 0 1 0 8.8 8.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function Menu() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
