import Link from 'next/link'
import { redirect } from 'next/navigation'
import AssetUploader from '@/components/manage/settings/AssetUploader'
import ColorField from '@/components/manage/settings/ColorField'
import NotificationsForm from '@/components/manage/settings/NotificationsForm'
import SettingsForm from '@/components/manage/settings/SettingsForm'
import DockerHosts from '@/components/manage/settings/DockerHosts'
import type { DockerHostsResponse } from '@/lib/docker'
import { defaultDescription, envDefaults } from '@/lib/branding'
import { can, manageFetch, requireUser } from '@/lib/manage'
import type { NotificationSettings } from '@/lib/notifications'
import { formatDateTimeLong } from '@/lib/time'
import PageHeader from '@/components/manage/PageHeader'

export const metadata = {
  title: 'Settings',
}

interface ManageSettings {
  values: Record<string, string | null>
  defaults: {
    timezone: string
    metrics_retention_days: number
    down_after_checks: number
    slow_alert_percent: number
    slow_checks: number
    slow_window: number
  }
  logo_version: number | null
  favicon_version: number | null
}

const TABS = [
  { id: 'general', label: 'General', permission: 'settings.general' },
  { id: 'appearance', label: 'Appearance', permission: 'settings.appearance' },
  { id: 'monitoring', label: 'Monitoring', permission: 'settings.monitoring' },
  { id: 'docker', label: 'Docker', permission: 'settings.docker' },
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

function slowOptions(current: string): { value: string; label: string }[] {
  const options = [
    { value: 'off', label: 'Off' },
    { value: '50', label: '50% slower' },
    { value: '200', label: '200% slower' },
    { value: '300', label: '300% slower' },
    { value: '500', label: '500% slower' },
  ]
  const known = options.some(function (option) {
    return option.value === current
  })
  if (current && !known) {
    options.push({ value: current, label: current + '% slower' })
  }
  return options
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
        <PageHeader title="Settings" description="Where the status page sends notifications." />
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

  let dockerHosts: DockerHostsResponse | null = null
  if (activeTab === 'docker') {
    try {
      dockerHosts = await manageFetch<DockerHostsResponse>('/docker-hosts')
    } catch {
      dockerHosts = null
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
      <PageHeader title="Settings" description="Leave a field empty to use the default from your .env file." />

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
            <div className="form-row">
              <label>
                <span>Company name</span>
                <input
                  key={'company_name-' + value(settings, 'company_name')}
                  name="company_name"
                  defaultValue={value(settings, 'company_name')}
                  maxLength={60}
                  placeholder={value(settings, 'site_name') || defaults.siteName}
                />
              </label>
              <label>
                <span>Company website</span>
                <input
                  key={'company_url-' + value(settings, 'company_url')}
                  name="company_url"
                  defaultValue={value(settings, 'company_url')}
                  placeholder="https://example.com"
                />
              </label>
            </div>
            <small className="field-hint">
              Shown in the copyright line on the sign-in page, linking to your website. Empty uses the site name and the status
              page.
            </small>
            <label>
              <span>Status page address</span>
              <input
                key={'public_url-' + value(settings, 'public_url')}
                name="public_url"
                defaultValue={value(settings, 'public_url')}
                placeholder="https://status.example.com"
                disabled={!user.is_admin}
              />
              <small className="field-hint">
                The address people use to open this status page. Notifications and password reset links point to it, and passkeys only
                work on this address. If you change it later, everyone has to add their passkeys again.
                {!user.is_admin && ' Only an admin can change it.'}
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

      {activeTab === 'docker' && dockerHosts && (
        <DockerHosts data={dockerHosts} canEdit={can(user, 'settings.docker')} />
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
            <label>
              <span>Warn when a service answers slower than usual</span>
              <select key={'slow_alert_percent-' + value(settings, 'slow_alert_percent')} name="slow_alert_percent" defaultValue={value(settings, 'slow_alert_percent')}>
                <option value="">{settings.defaults.slow_alert_percent}% slower (default)</option>
                {slowOptions(value(settings, 'slow_alert_percent')).map(function (option) {
                  return (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  )
                })}
              </select>
              <small className="field-hint">
                Compares each check with the usual response time of the past week, and only counts at least 100 ms extra.
                Goes to Discord, email, the panel and a notice on the status page, with one message for everything that turns
                slow at the same time.
              </small>
            </label>
            <div className="form-row">
              <label>
                <span>Slow checks</span>
                <input
                  key={'slow_checks-' + value(settings, 'slow_checks')}
                  name="slow_checks"
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={value(settings, 'slow_checks')}
                  placeholder={String(settings.defaults.slow_checks)}
                />
              </label>
              <label>
                <span>Out of the last</span>
                <input
                  key={'slow_window-' + value(settings, 'slow_window')}
                  name="slow_window"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={value(settings, 'slow_window')}
                  placeholder={String(settings.defaults.slow_window)}
                />
              </label>
            </div>
            <small className="field-hint">
              A service counts as slow when this many of its last checks were slow, and is back to normal when fewer are.
              The default of 3 of the last 5 keeps a single hiccup quiet; 1 of the last 1 warns about every slow check.
            </small>
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
