import NotFoundContent from '@/components/status/NotFoundContent'

export const metadata = {
  title: 'Page not found',
}

export default function PanelNotFound() {
  return (
    <div className="manage-page">
      <NotFoundContent homeHref="/manage" homeLabel="Back to the overview" />
    </div>
  )
}
