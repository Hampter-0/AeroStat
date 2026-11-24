import NotFoundContent from '@/components/status/NotFoundContent'

export const metadata = {
  title: 'Page not found',
}

export default function PublicNotFound() {
  return <NotFoundContent homeHref="/" homeLabel="Back to the status page" />
}
