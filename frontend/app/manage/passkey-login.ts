'use server'

import { redirect } from 'next/navigation'
import { errorMessage, manageFetch } from '@/lib/manage'
import type { PasskeyStep } from '@/lib/passkeys'
import { setSessionCookie } from '@/lib/session-cookie'

interface LoginChallenge {
  challenge_id: string
  options: unknown
}

interface LoginResponse {
  token: string
  expires_at: string
}

export async function startPasskeyLogin(): Promise<PasskeyStep<LoginChallenge>> {
  try {
    const challenge = await manageFetch<LoginChallenge>('/login/passkey', { method: 'POST' })
    return { error: null, data: challenge }
  } catch (error) {
    return { error: errorMessage(error), data: null }
  }
}

export async function finishPasskeyLogin(challengeId: string, credential: unknown): Promise<PasskeyStep<null>> {
  let session: LoginResponse
  try {
    session = await manageFetch<LoginResponse>('/login/passkey/finish', {
      method: 'POST',
      body: JSON.stringify({ challenge_id: challengeId, credential: credential }),
    })
  } catch (error) {
    return { error: errorMessage(error), data: null }
  }
  await setSessionCookie(session.token, session.expires_at)
  redirect('/manage')
}
