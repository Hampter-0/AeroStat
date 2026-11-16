import { getSiteConfig } from '@/lib/branding'
import { OG_COLORS, ogCard, type OgIcon } from '@/lib/og-card'

interface SavedCard {
  icon: string
  color: string
  headline: string
  subline: string
}

const ICONS: OgIcon[] = ['check', 'cross', 'alert', 'wrench', 'server']

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{32}$/.test(id)) {
    return new Response('Not found', { status: 404 })
  }

  const res = await fetch(process.env.API_URL + '/api/cards/' + id, { cache: 'no-store' })
  if (!res.ok) {
    return new Response('Not found', { status: 404 })
  }
  const card: SavedCard = await res.json()
  const config = await getSiteConfig()

  let icon: OgIcon = 'server'
  for (const option of ICONS) {
    if (option === card.icon) {
      icon = option
    }
  }
  let color = OG_COLORS.grey
  if (card.color === 'green' || card.color === 'red' || card.color === 'amber' || card.color === 'blue') {
    color = OG_COLORS[card.color]
  }

  const image = ogCard({ icon: icon, color: color, headline: card.headline, subline: card.subline, siteName: config.siteName })
  image.headers.set('cache-control', 'public, max-age=31536000, immutable')
  return image
}
