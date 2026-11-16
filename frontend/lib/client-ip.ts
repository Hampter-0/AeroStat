export function clientIp(forwarded: string | null): string | null {
  if (!forwarded) {
    return null
  }
  const hops = forwarded
    .split(',')
    .map(function (part) {
      return part.trim()
    })
    .filter(function (part) {
      return part !== ''
    })
  if (hops.length === 0) {
    return null
  }
  let trusted = Number(process.env.TRUSTED_PROXY_HOPS || '1')
  if (!Number.isInteger(trusted) || trusted < 1) {
    trusted = 1
  }
  let index = hops.length - trusted
  if (index < 0) {
    index = 0
  }
  let ip = hops[index]
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7)
  }
  return ip
}
