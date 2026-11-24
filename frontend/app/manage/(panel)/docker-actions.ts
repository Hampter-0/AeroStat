'use server'

import { revalidatePath } from 'next/cache'
import type { FormState } from '@/app/manage/actions'
import type { ContainerList } from '@/lib/docker'
import { errorMessage, manageFetch } from '@/lib/manage'

export async function listContainers(hostId: number | null): Promise<{ list: ContainerList | null; error: string | null }> {
  let path = '/docker/containers'
  if (hostId !== null) {
    path = path + '?host=' + hostId
  }
  try {
    const list = await manageFetch<ContainerList>(path)
    return { list: list, error: null }
  } catch (error) {
    return { list: null, error: errorMessage(error) }
  }
}

export async function createDockerHost(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    await manageFetch('/docker-hosts', {
      method: 'POST',
      body: JSON.stringify({ name: String(formData.get('name') || ''), address: String(formData.get('address') || '') }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/settings')
  return { error: null, success: 'Docker host added' }
}

export async function deleteDockerHost(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    await manageFetch('/docker-hosts/' + encodeURIComponent(String(formData.get('id') || '')), { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/settings')
  return { error: null, success: 'Docker host deleted' }
}
