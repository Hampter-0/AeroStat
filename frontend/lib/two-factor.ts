export interface TwoFactorStatus {
  app: boolean
  email: boolean
  app_available: boolean
  email_available: boolean
  email_address: string | null
  recovery_codes_left: number
  required: boolean
  preferred: 'app' | 'email' | null
}

export interface TwoFactorChallenge {
  challenge_id: string
  methods: string[]
  email_hint: string | null
}

export interface StepResult<T> {
  error: string | null
  data: T | null
}
