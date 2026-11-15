import Link from 'next/link'
import { redirect } from 'next/navigation'
import AssetUploader from '@/components/manage/settings/AssetUploader'
import ColorField from '@/components/manage/settings/ColorField'
import SettingsForm from '@/components/manage/settings/SettingsForm'
import { envDefaults } from '@/lib/branding'
import { can, manageFetch, requireUser } from '@/lib/manage'
import { formatDateTimeLong } from '@/lib/time'

export const metadata = {
  title: 'Settings',
}

interface ManageSettings {
  values: Record<string, string | null>
  defaults: { timezone: string; metrics_retention_days: number }
  logo_version: number | null
  favicon_version: number | null
}

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'time', label: 'Time & region' },
]

function value(settings: ManageSettings, key: string): string {
  const stored = settings.values[key]
  if (stored) {
    return stored
  }
  return ''
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser()
  if (!can(user, 'settings')) {
    redirect('/manage')
  }

  const settings = await manageFetch<ManageSettings>('/settings')
  const defaults = envDefaults()
  const { tab } = await searchParams

  let activeTab = 'general'
  for (const option of TABS) {
    if (option.id === tab) {
      activeTab = option.id
    }
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
        {TABS.map(function (option) {
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
              <span>Contact link</span>
              <input
                key={'contact_url-' + value(settings, 'contact_url')}
                name="contact_url"
                defaultValue={value(settings, 'contact_url')}
                placeholder="https://example.com/contact"
              />
              <small className="field-hint">A web page or a mailto: address. Leave empty to hide the Contact link.</small>
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
          </SettingsForm>
        </section>
      )}

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
