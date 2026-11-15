import { OG_SIZE } from '@/lib/og-card'
import { statusImage } from '@/lib/og-images'

export const alt = 'Current status'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  return statusImage()
}
