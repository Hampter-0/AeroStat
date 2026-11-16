export async function GET() {
  let ready = false
  try {
    const res = await fetch(process.env.API_URL + '/health', { cache: 'no-store' })
    ready = res.ok
  } catch {
    ready = false
  }
  let status = 503
  if (ready) {
    status = 200
  }
  return Response.json({ ready: ready }, { status: status, headers: { 'cache-control': 'no-store' } })
}
