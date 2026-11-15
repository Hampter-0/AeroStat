import { getPublicStatus, type OverallStatus, type PublicServiceStatus, type PublicStatus } from '@/lib/public-status'

const GREEN = '#2ea043'
const YELLOW = '#d29922'
const RED = '#e5484d'
const BLUE = '#1678c2'
const GREY = '#8b949e'

const OVERALL: Record<OverallStatus, { text: string; color: string }> = {
  operational: { text: 'operational', color: GREEN },
  degraded: { text: 'degraded', color: YELLOW },
  outage: { text: 'outage', color: RED },
  maintenance: { text: 'maintenance', color: BLUE },
  no_services: { text: 'no data', color: GREY },
}

const SERVICE: Record<PublicServiceStatus, { text: string; color: string }> = {
  online: { text: 'up', color: GREEN },
  offline: { text: 'down', color: RED },
  pending: { text: 'pending', color: GREY },
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function textWidth(text: string): number {
  return Math.ceil(text.length * 7) + 12
}

function badge(label: string, message: string, color: string): string {
  const labelWidth = textWidth(label)
  const messageWidth = textWidth(message)
  const width = labelWidth + messageWidth
  const safeLabel = escapeXml(label)
  const safeMessage = escapeXml(message)
  const labelX = labelWidth / 2
  const messageX = labelWidth + messageWidth / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${safeLabel}: ${safeMessage}">
<title>${safeLabel}: ${safeMessage}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${labelWidth}" height="20" fill="#555"/><rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/><rect width="${width}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${labelX}" y="15" fill="#010101" fill-opacity=".3">${safeLabel}</text><text x="${labelX}" y="14">${safeLabel}</text>
<text x="${messageX}" y="15" fill="#010101" fill-opacity=".3">${safeMessage}</text><text x="${messageX}" y="14">${safeMessage}</text>
</g>
</svg>`
}

function svgResponse(svg: string, maxAge: number) {
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=' + maxAge,
      'access-control-allow-origin': '*',
      'x-content-type-options': 'nosniff',
    },
  })
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const serviceId = params.get('service')
  const label = (params.get('label') || '').trim().slice(0, 40)

  let status: PublicStatus | null = null
  try {
    status = await getPublicStatus()
  } catch {
    status = null
  }
  if (!status) {
    return svgResponse(badge(label || 'status', 'unavailable', GREY), 30)
  }

  if (serviceId) {
    const service = status.services.find(function (item) {
      return item.id === serviceId
    })
    if (!service) {
      return svgResponse(badge(label || 'status', 'unknown service', GREY), 60)
    }
    const look = SERVICE[service.status]
    return svgResponse(badge(label || service.name, look.text, look.color), 60)
  }

  const look = OVERALL[status.status]
  return svgResponse(badge(label || 'status', look.text, look.color), 60)
}
