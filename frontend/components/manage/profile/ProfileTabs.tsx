import Link from 'next/link'

const TABS = [
  { href: '/manage/profile', label: 'Profile' },
  { href: '/manage/profile/sessions', label: 'Sessions' },
]

export default function ProfileTabs({ active }: { active: string }) {
  return (
    <nav className="settings-tabs" aria-label="Profile sections">
      {TABS.map(function (tab) {
        let className = ''
        if (tab.href === active) {
          className = 'active'
        }
        return (
          <Link href={tab.href} className={className} key={tab.href}>
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
