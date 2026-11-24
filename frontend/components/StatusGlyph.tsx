export type GlyphKind = 'alert' | 'check' | 'x' | 'clock' | 'wrench' | 'pending' | 'gauge'

export default function StatusGlyph({ kind, size }: { kind: GlyphKind; size?: number }) {
  let finalSize = size
  if (finalSize === undefined) {
    finalSize = 20
  }

  let circle = <circle cx="12" cy="12" r="10" />
  let inner = (
    <>
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </>
  )
  if (kind === 'check') {
    inner = <path d="m8.5 12 2.5 2.5 4.5-5" />
  } else if (kind === 'x') {
    inner = (
      <>
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
      </>
    )
  } else if (kind === 'clock') {
    inner = <path d="M12 7.5V12l3 2" />
  } else if (kind === 'wrench') {
    inner = <path d="M13.3 8.3a1 1 0 0 0 0 1.4l1 1a1 1 0 0 0 1.4 0l1.6-1.6a3.3 3.3 0 0 1-4.4 4.4l-3.6 3.6a1.3 1.3 0 0 1-1.8-1.8l3.6-3.6a3.3 3.3 0 0 1 4.4-4.4z" />
  } else if (kind === 'gauge') {
    circle = <></>
    inner = (
      <>
        <path d="m12 14 4-4" />
        <path d="M3.34 19a10 10 0 1 1 17.32 0" />
      </>
    )
  } else if (kind === 'pending') {
    circle = <circle cx="12" cy="12" r="10" strokeDasharray="3.2 3.1" />
    inner = <></>
  }

  return (
    <svg
      className="status-glyph"
      width={finalSize}
      height={finalSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {circle}
      {inner}
    </svg>
  )
}
