export interface ManageGroup {
  id: string
  name: string
  sort_order: number
}

export interface ManageService {
  id: string
  name: string
  check_type: string
  url: string
  group_id: string | null
  expected_status: number[]
  keyword: string | null
  keyword_absent: boolean
  dns_record_type: string | null
  dns_expected: string | null
  cert_warn_days: number | null
  cert_expires_at: string | null
  check_interval_seconds: number
  sort_order: number
  docker_host_id: number | null
  slow_above_ms: number | null
  slow_alerts: boolean
}

export interface CheckEntry {
  checked_at: string
  status: string
  response_time: number
  status_code: number | null
  error: string | null
  details: string | null
}

export interface CheckTest {
  status: string
  response_time: number
  status_code: number | null
  error: string | null
  details: string | null
}

export interface CheckType {
  value: string
  label: string
  group: string
  short: string
  target: string
  placeholder: string
  hint: string
}

export const CHECK_TYPES: CheckType[] = [
  {
    value: 'http',
    label: 'HTTP(S) website or API',
    group: 'Web',
    short: '',
    target: 'URL to check',
    placeholder: 'https://example.com/health',
    hint: 'Up when it answers with one of the expected status codes.',
  },
  {
    value: 'dns',
    label: 'DNS record',
    group: 'Web',
    short: 'DNS',
    target: 'Domain name',
    placeholder: 'example.com',
    hint: 'Up when the name has records of the chosen type.',
  },
  {
    value: 'ping',
    label: 'Ping',
    group: 'Network',
    short: 'Ping',
    target: 'Host or IP address',
    placeholder: 'server.example.com',
    hint: 'Up when it answers a ping (ICMP).',
  },
  {
    value: 'tcp',
    label: 'TCP port',
    group: 'Network',
    short: 'TCP',
    target: 'Host and port',
    placeholder: 'mail.example.com:25',
    hint: 'Up when a connection opens. For mail servers and anything else without a check of its own.',
  },
  {
    value: 'docker',
    label: 'Docker container',
    group: 'Network',
    short: 'Docker',
    target: 'Container name',
    placeholder: 'my-app',
    hint: 'Up when the container runs and is not unhealthy. Needs the Docker socket mounted into the backend, see the docs.',
  },
  {
    value: 'postgres',
    label: 'PostgreSQL',
    group: 'Databases',
    short: 'PostgreSQL',
    target: 'Host and port',
    placeholder: 'db.example.com:5432',
    hint: 'Up when it answers like PostgreSQL. No password needed, the port is 5432 when you leave it out.',
  },
  {
    value: 'mysql',
    label: 'MySQL or MariaDB',
    group: 'Databases',
    short: 'MySQL',
    target: 'Host and port',
    placeholder: 'db.example.com:3306',
    hint: 'Up when it greets like MySQL or MariaDB. No password needed, the port is 3306 when you leave it out.',
  },
  {
    value: 'redis',
    label: 'Redis',
    group: 'Databases',
    short: 'Redis',
    target: 'Host and port',
    placeholder: 'cache.example.com:6379',
    hint: 'Up when it answers PING. No password needed, the port is 6379 when you leave it out.',
  },
  {
    value: 'minecraft',
    label: 'Minecraft Java',
    group: 'Game servers',
    short: 'Minecraft',
    target: 'Server address',
    placeholder: 'play.example.com',
    hint: 'Up when it answers the server list ping. The port is 25565 when you leave it out.',
  },
  {
    value: 'bedrock',
    label: 'Minecraft Bedrock',
    group: 'Game servers',
    short: 'Bedrock',
    target: 'Server address',
    placeholder: 'play.example.com',
    hint: 'Up when it answers a Bedrock ping. The port is 19132 when you leave it out.',
  },
  {
    value: 'source',
    label: 'Source game (CS2, Rust, Garry’s Mod)',
    group: 'Game servers',
    short: 'Source',
    target: 'Server address',
    placeholder: 'play.example.com:27015',
    hint: 'Up when it answers a server info query. The port is 27015 when you leave it out.',
  },
]

export function checkTypeInfo(value: string): CheckType {
  const found = CHECK_TYPES.find(function (type) {
    return type.value === value
  })
  if (found) {
    return found
  }
  return CHECK_TYPES[0]
}

export function checkTypeGroups(): { name: string; types: CheckType[] }[] {
  const groups: { name: string; types: CheckType[] }[] = []
  for (const type of CHECK_TYPES) {
    let group = groups.find(function (item) {
      return item.name === type.group
    })
    if (!group) {
      group = { name: type.group, types: [] }
      groups.push(group)
    }
    group.types.push(type)
  }
  return groups
}

export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT']

export function checkTypeLabel(value: string): string {
  let label = value
  for (const type of CHECK_TYPES) {
    if (type.value === value) {
      label = type.label
    }
  }
  return label
}

export interface ManageServicesResponse {
  groups: ManageGroup[]
  services: ManageService[]
}

export const INTERVAL_UNITS = [
  { value: 'seconds', label: 'seconds', seconds: 1 },
  { value: 'minutes', label: 'minutes', seconds: 60 },
  { value: 'hours', label: 'hours', seconds: 3600 },
]

export function splitInterval(seconds: number): { amount: number; unit: string } {
  if (seconds % 3600 === 0) {
    return { amount: seconds / 3600, unit: 'hours' }
  }
  if (seconds % 60 === 0) {
    return { amount: seconds / 60, unit: 'minutes' }
  }
  return { amount: seconds, unit: 'seconds' }
}

export function intervalLabel(seconds: number): string {
  const parts = splitInterval(seconds)
  let unit = parts.unit
  if (parts.amount === 1) {
    unit = unit.slice(0, -1)
    return 'Every ' + unit
  }
  return 'Every ' + parts.amount + ' ' + unit
}
