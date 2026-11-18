import Logo from './Logo'

export default function PoweredBy() {
  return (
    <div className="powered-by">
      <Logo size={16} />
      <span>
        Powered by{' '}
        <a href="https://aerostatus.nl" target="_blank" rel="noopener">
          AeroStat
        </a>
      </span>
    </div>
  )
}
