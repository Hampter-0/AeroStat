import { NextResponse } from 'next/server'
import { getSessionToken } from '@/lib/manage'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = await getSessionToken()
  if (!token || !/^\d+$/.test(id)) {
    return new NextResponse(null, { status: 404 })
  }

  let upstream: Response | null = null
  try {
    upstream = await fetch(process.env.API_URL + '/api/manage/avatar/' + id, {
      headers: { authorization: 'Bearer ' + token },
      cache: 'no-store',
    })
  } catch {
    upstream = null
  }
  if (!upstream || !upstream.ok) {
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
      'cache-control': 'private, max-age=300',
      'x-content-type-options': 'nosniff',
    },
  })
}
