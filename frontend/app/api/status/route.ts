import { NextResponse } from 'next/server'
import { getPublicStatus } from '@/lib/public-status'

export async function GET() {
  try {
    const status = await getPublicStatus()
    return NextResponse.json(status, {
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=30',
      },
    })
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      {
        status: 503,
        headers: {
          'access-control-allow-origin': '*',
          'cache-control': 'no-store',
        },
      },
    )
  }
}
