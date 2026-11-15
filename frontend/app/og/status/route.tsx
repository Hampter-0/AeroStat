import { statusImage } from '@/lib/og-images'

export async function GET() {
  return statusImage()
}
