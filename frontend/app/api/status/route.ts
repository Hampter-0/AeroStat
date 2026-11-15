import { NextResponse } from 'next/server'
import { getPublicStatus, serviceDetail } from '@/lib/public-status'

const HEADERS = {
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=30',
}

export async function GET(request: Request) {
  const serviceId = new URL(request.url).searchParams.get('service')

  let status = null
  try {
    status = await getPublicStatus()
  } catch {
    status = null
  }
  if (!status) {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' } },
    )
  }

  if (serviceId) {
    const detail = serviceDetail(status, serviceId)
    if (!detail) {
      return NextResponse.json({ error: 'Unknown service' }, { status: 404, headers: HEADERS })
    }
    return NextResponse.json(detail, { headers: HEADERS })
  }

  return NextResponse.json(status, { headers: HEADERS })
}
