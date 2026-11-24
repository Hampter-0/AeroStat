import Logo from './Logo'

export default function SiteFooter({ siteName }: { siteName: string }) {
  return (
    <footer className="site-footer-simple">
      <span className="footer-logo">
        <Logo size={20} /> {siteName}
      </span>
      <span>© 2026 {siteName}, All times in UTC</span>
    </footer>
  )
}