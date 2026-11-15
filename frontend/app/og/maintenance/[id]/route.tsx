import { maintenanceImage } from '@/lib/og-images'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return maintenanceImage(id)
}
