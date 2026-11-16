export interface PasskeyInfo {
  id: number
  name: string
  discoverable: boolean
  created_at: string
  last_used_at: string | null
}

export interface PasskeysResponse {
  available: boolean
  password_login: boolean
  passkeys: PasskeyInfo[]
}

export interface PasskeyStep<T> {
  error: string | null
  data: T | null
}

export function browserError(error: unknown): string {
  if (error instanceof Error && error.name === 'NotAllowedError') {
    return 'The passkey prompt was closed or timed out. Try again.'
  }
  if (error instanceof Error && error.name === 'InvalidStateError') {
    return 'This device already has a passkey for your account.'
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Your browser could not use a passkey.'
}
