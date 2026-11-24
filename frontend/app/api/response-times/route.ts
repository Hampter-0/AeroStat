import { NextResponse } from 'next/server'
import { getResponseTimes } from '@/lib/api'

const HEADERS = {
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=60',
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  let range = 'day'
  const asked = params.get('range')
  if (asked === 'week' || asked === 'month') {
    range = asked
  }
  let service = ''
  const askedService = params.get('service')
  if (askedService) {
    service = askedService
  }

  const data = await getResponseTimes(range, service)
  if (!data) {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  return NextResponse.json(data, { headers: HEADERS })
}
