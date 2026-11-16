'use server'

import { redirect } from 'next/navigation'
import { errorMessage, manageFetch } from '@/lib/manage'
import { setSessionCookie } from '@/lib/session-cookie'
import type { StepResult } from '@/lib/two-factor'

interface LoginResponse {
  token: string
  expires_at: string
}

export async function sendLoginCode(challengeId: string): Promise<StepResult<null>> {
  try {
    await manageFetch('/login/two-factor/email', { method: 'POST', body: JSON.stringify({ challenge_id: challengeId }) })
    return { error: null, data: null }
  } catch (error) {
    return { error: errorMessage(error), data: null }
  }
}

export async function verifyLoginCode(challengeId: string, code: string): Promise<StepResult<null>> {
  let session: LoginResponse
  try {
    session = await manageFetch<LoginResponse>('/login/two-factor', {
      method: 'POST',
      body: JSON.stringify({ challenge_id: challengeId, code: code }),
    })
  } catch (error) {
    return { error: errorMessage(error), data: null }
  }
  await setSessionCookie(session.token, session.expires_at)
  redirect('/manage')
}
