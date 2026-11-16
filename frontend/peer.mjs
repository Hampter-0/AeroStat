import crypto from 'node:crypto'
import http from 'node:http'

const token = crypto.randomBytes(16).toString('hex')
process.env.AEROSTAT_PEER_TOKEN = token
const prefix = token + '|'
const emit = http.Server.prototype.emit

http.Server.prototype.emit = function (event, request) {
  if (event === 'request' && request && request.headers) {
    const current = request.headers['x-aerostat-peer']
    if (typeof current !== 'string' || !current.startsWith(prefix)) {
      let address = ''
      if (request.socket && request.socket.remoteAddress) {
        address = request.socket.remoteAddress
      }
      request.headers['x-aerostat-peer'] = prefix + address
    }
  }
  return emit.apply(this, arguments)
}
