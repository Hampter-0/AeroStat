import Logo from './Logo'

export default function PoweredBy({ siteName }: { siteName: string }) {
  return (
    <div className="powered-by">
      <Logo size={16} />
      <span>
        Powered by <strong>{siteName}</strong>
      </span>
    </div>
  )
}