import { OG_SIZE } from '@/lib/og-card'
import { maintenanceImage } from '@/lib/og-images'

export const alt = 'Maintenance'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return maintenanceImage(id)
}
