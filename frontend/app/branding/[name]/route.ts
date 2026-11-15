import { NextResponse } from 'next/server'

const ASSETS = ['logo', 'favicon']

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!ASSETS.includes(name)) {
    return new NextResponse(null, { status: 404 })
  }

  let upstream: Response | null = null
  try {
    upstream = await fetch(process.env.API_URL + '/api/brand/' + name, { cache: 'no-store' })
  } catch {
    upstream = null
  }

  if (!upstream || !upstream.ok) {
    if (name === 'logo') {
      return new NextResponse(null, { status: 307, headers: { location: '/brand/logo.svg' } })
    }
    return new NextResponse(null, { status: 404 })
  }

  let contentType = 'application/octet-stream'
  const upstreamType = upstream.headers.get('content-type')
  if (upstreamType) {
    contentType = upstreamType
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  })
}
