import { getSessionToken } from '@/lib/manage'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = await getSessionToken()
  if (!token) {
    return new Response('Not signed in', { status: 401 })
  }
  const res = await fetch(process.env.API_URL + '/api/manage/backups/' + encodeURIComponent(id) + '/download', {
    headers: { authorization: 'Bearer ' + token },
    cache: 'no-store',
  })
  if (!res.ok || !res.body) {
    let message = 'Could not download the backup'
    try {
      const body = await res.json()
      if (body.error) {
        message = body.error
      }
    } catch {
      message = 'Could not download the backup (' + res.status + ')'
    }
    return new Response(message, { status: res.status })
  }
  const headers = new Headers()
  for (const name of ['content-type', 'content-length', 'content-disposition']) {
    const value = res.headers.get(name)
    if (value) {
      headers.set(name, value)
    }
  }
  headers.set('cache-control', 'no-store')
  return new Response(res.body, { status: 200, headers: headers })
}
