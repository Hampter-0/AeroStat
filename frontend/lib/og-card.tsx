import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }

export type OgIcon = 'check' | 'cross' | 'alert' | 'wrench' | 'server'

const GREEN = '#22a45d'
const RED = '#e5484d'
const AMBER = '#d29922'
const BLUE = '#1678c2'
const GREY = '#8b949e'

export const OG_COLORS = { green: GREEN, red: RED, amber: AMBER, blue: BLUE, grey: GREY }

function Icon({ icon }: { icon: OgIcon }) {
  let path = 'M30 50 l14 14 28 -30'
  if (icon === 'cross') {
    path = 'M34 34 L66 66 M66 34 L34 66'
  } else if (icon === 'alert') {
    path = 'M50 28 L50 56 M50 70 L50 71'
  } else if (icon === 'wrench') {
    path = 'M62 30 a14 14 0 0 0 -18 18 L28 64 a5 5 0 0 0 8 8 L52 56 a14 14 0 0 0 18 -18 l-9 9 -8 -2 -2 -8 Z'
  } else if (icon === 'server') {
    path = 'M24 26 h52 v20 h-52 Z M24 54 h52 v20 h-52 Z M36 36 h0.1 M36 64 h0.1'
  }
  return (
    <svg width="64" height="64" viewBox="0 0 100 100">
      <path d={path} fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ogCard({
  icon,
  color,
  headline,
  subline,
  siteName,
}: {
  icon: OgIcon
  color: string
  headline: string
  subline: string
  siteName: string
}) {
  let headlineSize = 64
  if (headline.length > 40) {
    headlineSize = 52
  }
  if (headline.length > 70) {
    headlineSize = 42
  }
  let footerPrefix = siteName + ' · Powered by'
  if (siteName === 'AeroStat') {
    footerPrefix = 'Powered by'
  }
  let shortHeadline = headline
  if (headline.length > 110) {
    shortHeadline = headline.slice(0, 107) + '…'
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 90px',
          background: '#ffffff',
          color: '#0f172a',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 66,
            background: color,
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.15)',
          }}
        >
          <Icon icon={icon} />
        </div>
        <div
          style={{
            marginTop: 40,
            display: 'flex',
            textAlign: 'center',
            fontSize: headlineSize,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          {shortHeadline}
        </div>
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center', textAlign: 'center', fontSize: 28, color: '#64748b' }}>
          {subline}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            fontSize: 22,
            color: '#94a3b8',
          }}
        >
          <span>{footerPrefix}</span>
          <svg width="24" height="24" viewBox="0 0 36 36" style={{ marginLeft: 10, marginRight: 6 }}>
            <path d="M18 3 L32 31 H23 L18 21 L13 31 H4 Z M18 12 L13 24 H23 Z" fill="#56c7e4" fillRule="evenodd" />
          </svg>
          <span style={{ color: '#64748b' }}>AeroStat</span>
        </div>
      </div>
    ),
    OG_SIZE,
  )
}
