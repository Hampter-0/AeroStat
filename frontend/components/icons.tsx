export function Check({ size }: { size?: number }) {
    let finalSize = size
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
    let className = 'chevron'
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
  let finalSize = size
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
  let finalSize = size
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
  let finalSize = size
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
  let finalSize = size
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

export function Home() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 9 10 3.5 16.5 9v7a1 1 0 0 1-1 1h-3.5v-4.5h-4V17H4.5a1 1 0 0 1-1-1V9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function Users() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 16.5c.6-2.6 2.8-4 5.5-4s4.9 1.4 5.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13 4.2a3 3 0 0 1 0 5.6M14.8 12.7c1.6.5 2.8 1.8 3.2 3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function AtSign() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 7v4a2 2 0 0 0 4 0v-1a7 7 0 1 0-2.8 5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function Key() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="13.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m9 11 7.5-7.5M14 6l2 2M12 8l1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LogIn() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12 3h3.5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H12M8 14l4-4-4-4M12 10H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Bell() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 13V9a5 5 0 0 1 10 0v4l1.5 2h-13L5 13ZM8.5 17.5a1.6 1.6 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Shield() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.5 4 4.8v4.6c0 3.8 2.5 6.7 6 8.1 3.5-1.4 6-4.3 6-8.1V4.8L10 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m7.5 10 1.8 1.8L12.8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LogOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8 17H4.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H8M13 14l4-4-4-4M17 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ExternalLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M11 3.5h5.5V9M16.5 3.5 9 11M14 12v3.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function User() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx="10" cy="6.5" r="3.5" />
      <path d="M3.5 17c.5-3.3 3.1-5.5 6.5-5.5s6 2.2 6.5 5.5a.8.8 0 0 1-.8.9H4.3a.8.8 0 0 1-.8-.9Z" />
    </svg>
  )
}

export function Lock({ size }: { size?: number }) {
  let px = 16
  if (size) {
    px = size
  }
  return (
    <svg width={px} height={px} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6 8V6.5a4 4 0 0 1 8 0V8h.5A1.5 1.5 0 0 1 16 9.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16.5v-7A1.5 1.5 0 0 1 5.5 8H6Zm1.6 0h4.8V6.5a2.4 2.4 0 0 0-4.8 0V8Z" />
    </svg>
  )
}

export function ArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 16V4M5 9l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ArrowDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4v12M5 11l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Server({ size }: { size?: number }) {
  let finalSize = 16
  if (size) {
    finalSize = size
  }
  return (
    <svg width={finalSize} height={finalSize} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3.5" width="14" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="14" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6.25h.01M6 13.75h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function Settings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

export function Activity() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 10h3l2.5-6 4 12 2.5-6h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Search() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function SystemIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export function Cpu() {
  return (
    <SystemIcon>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M9 2.5v3.5M15 2.5v3.5M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" />
    </SystemIcon>
  )
}

export function MemoryChip() {
  return (
    <SystemIcon>
      <rect x="2.5" y="7" width="19" height="10" rx="1.5" />
      <path d="M6.5 10.5v3M10 10.5v3M14 10.5v3M17.5 10.5v3M6 17v2.5M18 17v2.5" />
    </SystemIcon>
  )
}

export function Database() {
  return (
    <SystemIcon>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v13c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-13M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" />
    </SystemIcon>
  )
}

export function Layers() {
  return (
    <SystemIcon>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </SystemIcon>
  )
}

export function Package() {
  return (
    <SystemIcon>
      <path d="m12 2.5 8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5L12 2.5Z" />
      <path d="m3.5 7.25 8.5 4.75 8.5-4.75M12 12v9.5" />
    </SystemIcon>
  )
}

export function Terminal() {
  return (
    <SystemIcon>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="m7 9.5 3 2.5-3 2.5M12.5 15h4.5" />
    </SystemIcon>
  )
}

export function Clock() {
  return (
    <SystemIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </SystemIcon>
  )
}

export function Gauge() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 18a9 9 0 1 1 15 0" />
      <path d="m12 13 4-4" />
      <circle cx="12" cy="13.5" r="1.2" />
    </svg>
  )
}

export function Smartphone() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="5.5" y="2.5" width="9" height="15" rx="1.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 14.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function Crown({ size }: { size?: number }) {
  let px = 14
  if (size) {
    px = size
  }
  return (
    <svg width={px} height={px} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M3 6.5 6.5 9 10 4l3.5 5L17 6.5 15.6 15H4.4L3 6.5Z" />
      <rect x="4.4" y="16" width="11.2" height="1.6" rx="0.8" />
    </svg>
  )
}

export function LockOpen({ size }: { size?: number }) {
  let px = 16
  if (size) {
    px = size
  }
  return (
    <svg width={px} height={px} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <rect x="2" y="9" width="12" height="9" rx="1.5" />
      <path
        d="M10.2 9.5V6.5a3.4 3.4 0 0 1 6.8 0V8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Mail() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M3.5 4.5h13A1.5 1.5 0 0 1 18 6v.3l-8 4.9-8-4.9V6a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M2 8.1V14a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 18 14V8.1l-7.6 4.6a.8.8 0 0 1-.8 0L2 8.1Z" />
    </svg>
  )
}

export function Eye() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 4C5.5 4 2.4 7.4 1.4 9.6a1 1 0 0 0 0 .8C2.4 12.6 5.5 16 10 16s7.6-3.4 8.6-5.6a1 1 0 0 0 0-.8C17.6 7.4 14.5 4 10 4Zm0 9.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm0-5.3a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z" />
    </svg>
  )
}

export function EyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M3.3 2.3a.8.8 0 0 0-1.1 1.1l2 2C2.8 6.6 1.9 8.1 1.4 9.6a1 1 0 0 0 0 .8C2.4 12.6 5.5 16 10 16c1.6 0 3-.4 4.2-1.1l2.5 2.5a.8.8 0 0 0 1.1-1.1L3.3 2.3Zm6.7 11.2a3.5 3.5 0 0 1-3.3-4.6l1.4 1.4a1.8 1.8 0 0 0 2.1 2.1l1.4 1.4c-.5.2-1 .3-1.6.3ZM10 4c4.5 0 7.6 3.4 8.6 5.6a1 1 0 0 1 0 .8 9.8 9.8 0 0 1-2.6 3.3L13.4 11a3.5 3.5 0 0 0-4.4-4.4L7.2 4.8C8.1 4.3 9 4 10 4Z" />
    </svg>
  )
}

export function Upload() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 13V3.5M6 7.5l4-4 4 4M3.5 13v2.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Copy() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function HelpCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.8 7.6a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 2-2.2 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="14.2" r="0.9" fill="currentColor" />
    </svg>
  )
}
