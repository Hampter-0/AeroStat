import Link from 'next/link'
import { redirect } from 'next/navigation'
import AssetUploader from '@/components/manage/settings/AssetUploader'
import ColorField from '@/components/manage/settings/ColorField'
import NotificationsForm from '@/components/manage/settings/NotificationsForm'
import SettingsForm from '@/components/manage/settings/SettingsForm'
import { defaultDescription, envDefaults } from '@/lib/branding'
import { can, manageFetch, requireUser } from '@/lib/manage'
import type { NotificationSettings } from '@/lib/notifications'
import { formatDateTimeLong } from '@/lib/time'

export const metadata = {
  title: 'Settings',
}

interface ManageSettings {
  values: Record<string, string | null>
  defaults: { timezone: string; metrics_retention_days: number; down_after_checks: number }
  logo_version: number | null
  favicon_version: number | null
}

const TABS = [
  { id: 'general', label: 'General', permission: 'settings.general' },
  { id: 'appearance', label: 'Appearance', permission: 'settings.appearance' },
  { id: 'monitoring', label: 'Monitoring', permission: 'settings.monitoring' },
  { id: 'time', label: 'Time & region', permission: 'settings.time' },
  { id: 'notifications', label: 'Notifications', permission: 'settings.notifications' },
]

function value(settings: ManageSettings, key: string): string {
  const stored = settings.values[key]
  if (stored) {
    return stored
  }
  return ''
}

function NotificationsTab({ notifications }: { notifications: NotificationSettings }) {
  return (
    <>
      <section className="manage-panel">
        <h2>Discord</h2>
        <p className="panel-intro">Post a message in a Discord channel when something happens. Only people with the Notifications permission can see or change this.</p>
        <NotificationsForm settings={notifications} />
      </section>
      <section className="manage-panel">
        <h2>Email</h2>
        <p className="panel-intro">
          Everyone picks their own email notifications on their <Link href="/manage/profile">Profile</Link>, and only gets the ones they have access
          to.
        </p>
      </section>
    </>
  )
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser()
  const tabs = TABS.filter(function (option) {
    return can(user, option.permission)
  })
  if (tabs.length === 0) {
    redirect('/manage')
  }
  const { tab } = await searchParams

  if (tabs.length === 1 && tabs[0].id === 'notifications') {
    const onlyNotifications = await manageFetch<NotificationSettings>('/notifications')
    return (
      <div className="manage-page">
        <header className="manage-page-header">
          <h1>Settings</h1>
          <p>Where the status page sends notifications.</p>
        </header>
        <NotificationsTab notifications={onlyNotifications} />
      </div>
    )
  }

  const settings = await manageFetch<ManageSettings>('/settings')
  const defaults = envDefaults()

  let activeTab = tabs[0].id
  for (const option of tabs) {
    if (option.id === tab) {
      activeTab = option.id
    }
  }

  let notifications: NotificationSettings | null = null
  if (activeTab === 'notifications') {
    notifications = await manageFetch<NotificationSettings>('/notifications')
  }

  let timezone = settings.defaults.timezone
  if (settings.values.timezone) {
    timezone = settings.values.timezone
  }
  const timezones = Intl.supportedValuesOf('timeZone')
  if (!timezones.includes('UTC')) {
    timezones.unshift('UTC')
  }

  let logoPreview: string | null = null
  if (settings.logo_version) {
    logoPreview = '/branding/logo?v=' + settings.logo_version
  } else {
    logoPreview = '/brand/logo.svg'
  }
  let faviconPreview: string | null = null
  if (settings.favicon_version) {
    faviconPreview = '/branding/favicon?v=' + settings.favicon_version
  }

  return (
    <div className="manage-page">
      <header className="manage-page-header">
        <h1>Settings</h1>
        <p>Leave a field empty to use the default from your .env file.</p>
      </header>

      <nav className="settings-tabs" aria-label="Settings sections">
        {tabs.map(function (option) {
          let className = ''
          if (option.id === activeTab) {
            className = 'active'
          }
          return (
            <Link href={'/manage/settings?tab=' + option.id} className={className} key={option.id}>
              {option.label}
            </Link>
          )
        })}
      </nav>

      {activeTab === 'general' && (
        <section className="manage-panel">
          <h2>General</h2>
          <SettingsForm>
            <label>
              <span>Site name</span>
              <input
                key={'site_name-' + value(settings, 'site_name')}
                name="site_name"
                defaultValue={value(settings, 'site_name')}
                maxLength={60}
                placeholder={defaults.siteName}
              />
              <small className="field-hint">Shown in the header, the browser tab and the footer.</small>
            </label>
            <label>
              <span>Description</span>
              <textarea
                key={'site_description-' + value(settings, 'site_description')}
                name="site_description"
                defaultValue={value(settings, 'site_description')}
                maxLength={200}
                rows={2}
                placeholder={defaultDescription(value(settings, 'site_name') || defaults.siteName)}
              />
              <small className="field-hint">Shown under the link when someone shares your status page, for example in Discord.</small>
            </label>
            <label>
              <span>Contact link</span>
              <input
                key={'contact_url-' + value(settings, 'contact_url')}
                name="contact_url"
                defaultValue={value(settings, 'contact_url')}
                placeholder="https://example.com/contact"
              />
              <small className="field-hint">A web page or a mailto: address. Leave empty to hide the Contact link.</small>
            </label>
            <label>
              <span>Status page address</span>
              <input
                key={'public_url-' + value(settings, 'public_url')}
                name="public_url"
                defaultValue={value(settings, 'public_url')}
                placeholder="https://status.example.com"
              />
              <small className="field-hint">
                The address people use to open this status page. Notifications link to it, and passkeys only work on this address. If you change
                it later, everyone has to add their passkeys again.
              </small>
            </label>
          </SettingsForm>
        </section>
      )}

      {activeTab === 'appearance' && (
        <>
          <section className="manage-panel">
            <h2>Accent color</h2>
            <SettingsForm>
              <ColorField
                key={'primary_color-' + value(settings, 'primary_color')}
                value={value(settings, 'primary_color')}
                fallback={defaults.accentColor}
              />
            </SettingsForm>
          </section>
          <section className="manage-panel">
            <h2>Logo & favicon</h2>
            <div className="asset-list">
              <AssetUploader
                name="logo"
                label="Logo"
                hint="Square works best. PNG, SVG, JPG or WebP, up to 1 MB."
                previewUrl={logoPreview}
                isCustom={settings.logo_version !== null}
              />
              <AssetUploader
                name="favicon"
                label="Favicon"
                hint="The icon in the browser tab. Square PNG, SVG or ICO, up to 1 MB."
                previewUrl={faviconPreview}
                isCustom={settings.favicon_version !== null}
              />
            </div>
          </section>
        </>
      )}

      {activeTab === 'monitoring' && (
        <section className="manage-panel">
          <h2>Monitoring</h2>
          <SettingsForm>
            <label>
              <span>Keep check history for (days)</span>
              <input
                key={'metrics_retention_days-' + value(settings, 'metrics_retention_days')}
                name="metrics_retention_days"
                type="number"
                min={7}
                max={3650}
                defaultValue={value(settings, 'metrics_retention_days')}
                placeholder={String(settings.defaults.metrics_retention_days)}
              />
              <small className="field-hint">
                Older checks are deleted once a day. The uptime percentage and the bars cover the last 60 days, so keep at least 60.
              </small>
            </label>
            <label>
              <span>Failed checks before a service is down</span>
              <input
                key={'down_after_checks-' + value(settings, 'down_after_checks')}
                name="down_after_checks"
                type="number"
                min={1}
                max={10}
                defaultValue={value(settings, 'down_after_checks')}
                placeholder={String(settings.defaults.down_after_checks)}
              />
              <small className="field-hint">
                Discord and email messages go out after this many failed checks in a row. 1 sends one right away, 2 keeps a
                single hiccup quiet.
              </small>
            </label>
          </SettingsForm>
        </section>
      )}

      {activeTab === 'notifications' && notifications && <NotificationsTab notifications={notifications} />}

      {activeTab === 'time' && (
        <section className="manage-panel">
          <h2>Time & region</h2>
          <SettingsForm>
            <label>
              <span>Timezone</span>
              <select key={'timezone-' + timezone} name="timezone" defaultValue={timezone}>
                {timezones.map(function (zone) {
                  return (
                    <option value={zone} key={zone}>
                      {zone.replaceAll('_', ' ')}
                    </option>
                  )
                })}
              </select>
              <small className="field-hint">
                All dates and times on the status page and in this panel use this timezone, and each uptime bar covers one day in it.
                Right now it is {formatDateTimeLong(new Date().toISOString(), timezone)}.
              </small>
            </label>
          </SettingsForm>
        </section>
      )}
    </div>
  )
}
