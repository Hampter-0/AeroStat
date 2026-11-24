import PublicLayout from './(public)/layout'
import NotFoundContent from '@/components/status/NotFoundContent'

export const metadata = {
  title: 'Page not found',
}

export default function NotFound() {
  return (
    <PublicLayout>
      <NotFoundContent homeHref="/" homeLabel="Back to the status page" />
    </PublicLayout>
  )
}
