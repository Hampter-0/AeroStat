import { clientIp } from '@/lib/client-ip'
import { getSessionToken } from '@/lib/manage'

export async function POST(request: Request) {
  const token = await getSessionToken()
  if (!token) {
    return Response.json({ error: 'Not signed in' }, { status: 401 })
  }
  if (!request.body) {
    return Response.json({ error: 'Choose a file first' }, { status: 400 })
  }
  const headers = new Headers()
  headers.set('authorization', 'Bearer ' + token)
  headers.set('content-type', 'application/octet-stream')
  const name = request.headers.get('x-file-name')
  if (name) {
    let decoded = name
    try {
      decoded = decodeURIComponent(name)
    } catch {
      decoded = name
    }
    headers.set('x-file-name', decoded.replace(/[^ -~]/g, '_'))
  }
  const ip = clientIp(request.headers.get('x-forwarded-for'))
  if (ip) {
    headers.set('x-forwarded-for', ip)
  }
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    headers: headers,
    body: request.body,
    cache: 'no-store',
    duplex: 'half',
  }
  const res = await fetch(process.env.API_URL + '/api/manage/backups/upload', init)
  const text = await res.text()
  return new Response(text, { status: res.status, headers: { 'content-type': 'application/json' } })
}
