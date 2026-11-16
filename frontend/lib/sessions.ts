export interface SessionInfo {
  id: number
  ip: string | null
  user_agent: string | null
  created_at: string
  last_used_at: string
  expires_at: string
  current: boolean
}

export interface SessionRow {
  id: number
  ip: string
  device: string
  userAgent: string
  lastUsed: string
  current: boolean
}

function browserName(agent: string): string {
  if (agent.includes('Edg/')) {
    return 'Edge'
  }
  if (agent.includes('OPR/') || agent.includes('Opera')) {
    return 'Opera'
  }
  if (agent.includes('Firefox/')) {
    return 'Firefox'
  }
  if (agent.includes('Chrome/') || agent.includes('CriOS/')) {
    return 'Chrome'
  }
  if (agent.includes('Safari/')) {
    return 'Safari'
  }
  return 'Unknown browser'
}

function systemName(agent: string): string {
  if (agent.includes('Android')) {
    return 'Android'
  }
  if (agent.includes('iPhone') || agent.includes('iPad')) {
    return 'iOS'
  }
  if (agent.includes('Windows')) {
    return 'Windows'
  }
  if (agent.includes('Mac OS X') || agent.includes('Macintosh')) {
    return 'macOS'
  }
  if (agent.includes('Linux')) {
    return 'Linux'
  }
  return 'an unknown system'
}

export function describeAgent(agent: string | null): string {
  if (!agent) {
    return 'Unknown device'
  }
  return browserName(agent) + ' on ' + systemName(agent)
}
