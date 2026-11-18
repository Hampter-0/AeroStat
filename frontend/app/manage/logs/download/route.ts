import { getSessionToken } from '@/lib/manage'

export async function GET(request: Request) {
  const token = await getSessionToken()
  if (!token) {
    return new Response('Not signed in', { status: 401 })
  }
  const search = new URL(request.url).search
  const res = await fetch(process.env.API_URL + '/api/manage/system/logs/download' + search, {
    headers: { authorization: 'Bearer ' + token },
    cache: 'no-store',
  })
  if (!res.ok || !res.body) {
    let message = 'Could not download the logs'
    try {
      const body = await res.json()
      if (body.error) {
        message = body.error
      }
    } catch {
      message = 'Could not download the logs (' + res.status + ')'
    }
    return new Response(message, { status: res.status })
  }
  const headers = new Headers()
  for (const name of ['content-type', 'content-disposition']) {
    const value = res.headers.get(name)
    if (value) {
      headers.set(name, value)
    }
  }
  headers.set('cache-control', 'no-store')
  return new Response(res.body, { status: 200, headers: headers })
}
