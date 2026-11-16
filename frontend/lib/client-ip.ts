function normalize(ip: string): string {
  let value = ip.trim()
  if (value.startsWith('::ffff:')) {
    value = value.slice(7)
  }
  return value
}

function isPrivate(ip: string): boolean {
  const value = normalize(ip).toLowerCase()
  if (value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')) {
    return true
  }
  const parts = value.split('.').map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return false
  }
  const [a, b] = parts
  if (a === 127 || a === 10) {
    return true
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true
  }
  if (a === 192 && b === 168) {
    return true
  }
  if (a === 169 && b === 254) {
    return true
  }
  return false
}

function peerAddress(peer: string | null): string | null {
  const token = process.env.AEROSTAT_PEER_TOKEN
  if (!peer || !token) {
    return null
  }
  const prefix = token + '|'
  if (!peer.startsWith(prefix)) {
    return null
  }
  const address = normalize(peer.slice(prefix.length))
  if (address === '') {
    return null
  }
  return address
}

function fromForwarded(forwarded: string | null): string | null {
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
  return normalize(hops[index])
}

export function clientIp(forwarded: string | null, peer: string | null): string | null {
  const direct = peerAddress(peer)
  if (direct && !isPrivate(direct)) {
    return direct
  }
  const viaProxy = fromForwarded(forwarded)
  if (viaProxy) {
    return viaProxy
  }
  return direct
}
