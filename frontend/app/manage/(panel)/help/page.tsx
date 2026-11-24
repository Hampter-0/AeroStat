import type { ReactNode } from 'react'
import { AlertTriangle, Check, ExternalLink } from '@/components/icons'
import { can, manageFetch, requireUser } from '@/lib/manage'
import PageHeader from '@/components/manage/PageHeader'

export const metadata = {
  title: 'Help',
}

const GITHUB = 'https://github.com/Hampter-0/AeroStat'
const DOCS = 'https://docs.aerostatus.nl'

const LINKS = [
  { href: DOCS, label: 'Docs', note: 'Install, configure and use AeroStat' },
  { href: 'https://discord.gg/45gRX62b77', label: 'Discord', note: 'Ask questions and share ideas with other users' },
  { href: GITHUB, label: 'GitHub', note: 'Code and releases' },
  { href: GITHUB + '/issues', label: 'Report a problem', note: 'Open an issue on GitHub' },
  { href: 'https://hub.docker.com/r/hampternom/aerostat-backend', label: 'Docker Hub: backend', note: 'hampternom/aerostat-backend' },
  { href: 'https://hub.docker.com/r/hampternom/aerostat-frontend', label: 'Docker Hub: frontend', note: 'hampternom/aerostat-frontend' },
]

const NGINX = `server {
    listen 443 ssl;
    server_name status.example.com;

    client_max_body_size 2g;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}`

const CADDY = `status.example.com {
    reverse_proxy 127.0.0.1:3000
}`

const CLOUDFLARE_NGINX = `real_ip_header CF-Connecting-IP;
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;`

const SMTP = `SMTP_HOST=mail.example.com
SMTP_PORT=465
SMTP_ENCRYPTION=tls
SMTP_USERNAME=noreply@example.com
SMTP_PASSWORD=your-password
SMTP_FROM_ADDRESS=noreply@example.com`

interface InstallStatus {
  email: boolean
  authenticator_app: boolean
  public_url: string | null
  backup_tool: string | null
  client_ip: string
  client_ip_private: boolean
}

function StatusTile({ ok, label, value, note }: { ok: boolean; label: string; value: string; note: string }) {
  let className = 'health-tile ok'
  let icon = <Check size={14} />
  if (!ok) {
    className = 'health-tile warn'
    icon = <AlertTriangle size={14} />
  }
  return (
    <div className={className}>
      <span className="health-tile-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  )
}

function Guide({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="help-guide">
      <summary>{title}</summary>
      <div className="help-guide-body">{children}</div>
    </details>
  )
}

function Code({ children }: { children: string }) {
  return <pre className="help-code">{children}</pre>
}

export default async function HelpPage() {
  const user = await requireUser()
  let status: InstallStatus | null = null
  if (can(user, 'system.view')) {
    try {
      status = await manageFetch<InstallStatus>('/help/status')
    } catch {
      status = null
    }
  }

  let ipNote = 'This is your own address, so the sign-in block works per visitor.'
  let emailValue = 'Not set up'
  let emailNote = 'Add the SMTP settings to .env, see Email below.'
  let appValue = 'Not available'
  let appNote = 'Set SECRET_KEY in .env, see Two-factor below.'
  let addressValue = 'Not set'
  let addressNote = 'Set it under Settings → General for passkeys and password reset.'
  let backupValue = 'pg_dump not found'
  let backupNote = 'The Docker image has it. Outside Docker, install the PostgreSQL client.'
  if (status) {
    if (status.client_ip_private) {
      ipNote = 'This is a private address, so your proxy doesn’t pass visitors’ addresses on. See Reverse proxy below.'
    }
    if (status.email) {
      emailValue = 'Set up'
      emailNote = 'Notifications, email codes and password reset can be sent.'
    }
    if (status.authenticator_app) {
      appValue = 'Available'
      appNote = 'SECRET_KEY is set.'
    }
    if (status.public_url) {
      addressValue = status.public_url
      addressNote = 'Used for links, passkeys and password reset.'
    }
    if (status.backup_tool) {
      backupValue = 'Available'
      backupNote = status.backup_tool
    }
  }

  return (
    <div className="manage-page">
      <PageHeader title="Help" description="Where to get help, how to set things up and what to do when something goes wrong." />

      {status && (
        <section className="manage-panel">
          <h2>Your installation</h2>
          <div className="info-grid">
            <StatusTile ok={status.email} label="Email" value={emailValue} note={emailNote} />
            <StatusTile ok={status.authenticator_app} label="Authenticator app" value={appValue} note={appNote} />
            <StatusTile ok={status.public_url !== null} label="Status page address" value={addressValue} note={addressNote} />
            <StatusTile ok={status.backup_tool !== null} label="Backups" value={backupValue} note={backupNote} />
            <StatusTile ok={!status.client_ip_private} label="Your IP as AeroStat sees it" value={status.client_ip} note={ipNote} />
          </div>
        </section>
      )}

      <section className="manage-panel">
        <h2>Links</h2>
        <div className="help-links">
          {LINKS.map(function (link) {
            return (
              <a href={link.href} target="_blank" rel="noreferrer" className="help-link" key={link.href}>
                <strong>
                  {link.label} <ExternalLink />
                </strong>
                <small>{link.note}</small>
              </a>
            )
          })}
        </div>
      </section>

      <section className="manage-panel">
        <h2>For everyone</h2>
        <Guide title="Turn on two-factor sign-in">
          <p>
            Go to <strong>Profile → Two-factor sign-in</strong>. Pick the authenticator app (1Password, Bitwarden, Google
            Authenticator, Aegis) or email codes. Save the recovery codes you get somewhere safe: each one signs you in once
            when your phone or email is out of reach.
          </p>
          <p>With both on, choose under Ask first which one sign-in asks for. The other stays available.</p>
        </Guide>
        <Guide title="Sign in with a passkey">
          <p>
            Add one under <strong>Profile → Security keys</strong>: your fingerprint, face, phone or a security key. Then sign
            in with the passkey button on the sign-in page. With a passkey you can turn password sign-in off.
          </p>
        </Guide>
        <Guide title="I forgot my password">
          <p>
            Use <strong>Forgot password?</strong> on the sign-in page. The link in the email works once, for 30 minutes. No
            button there? Then email isn’t set up; ask an admin to set a new password for you.
          </p>
        </Guide>
        <Guide title="I lost my phone with the authenticator app">
          <p>
            Sign in with one of your recovery codes, or with an email code if that is on. No codes left? Ask an admin to use{' '}
            <strong>Reset two-factor</strong> on your account under Users.
          </p>
        </Guide>
        <Guide title="“Too many failed sign-in attempts”">
          <p>
            Wait the minutes it says. The block never stops you from a device you signed in from before. An admin can lift it
            right away from the server:
          </p>
          <Code>docker compose exec -it backend aerostat cli</Code>
          <p>
            and pick <code>unblock</code>.
          </p>
        </Guide>
      </section>

      <section className="manage-panel">
        <h2>Setting up the server</h2>
        <Guide title="Email">
          <p>Add your mail server to .env next to docker-compose.yml, then restart with docker compose up -d:</p>
          <Code>{SMTP}</Code>
          <p>Send a test email under System → Email. Each user picks their notifications on their profile.</p>
        </Guide>
        <Guide title="Two-factor with an authenticator app (SECRET_KEY)">
          <p>The app needs a key that encrypts its secrets. Make one and add it to .env as SECRET_KEY:</p>
          <Code>openssl rand -hex 32</Code>
          <p>
            Keep it with your backups. If it changes, everyone has to set up their app again. Check that the container gets it
            (it should print 65):
          </p>
          <Code>docker compose exec backend printenv SECRET_KEY | wc -c</Code>
        </Guide>
        <Guide title="Passkeys and password reset">
          <p>
            Both need the status page address under <strong>Settings → General</strong>, for example
            https://status.example.com. Passkeys only work on that address; change it later and everyone has to add their
            passkeys again.
          </p>
        </Guide>
        <Guide title="Reverse proxy (nginx, Caddy)">
          <p>Set AEROSTAT_BIND=127.0.0.1 in .env so only the proxy can reach port 3000. nginx:</p>
          <Code>{NGINX}</Code>
          <p>Caddy does everything by default:</p>
          <Code>{CADDY}</Code>
        </Guide>
        <Guide title="Cloudflare in front of nginx">
          <p>
            Otherwise every visitor looks like a Cloudflare address. Add this to the http block, for example in
            /etc/nginx/conf.d/cloudflare.conf, and keep X-Forwarded-For $remote_addr. Check your IP under Your installation
            above or under Profile → Sessions.
          </p>
          <Code>{CLOUDFLARE_NGINX}</Code>
          <p>Cloudflare’s free plan accepts uploads up to 100 MB.</p>
        </Guide>
        <Guide title="Updating">
          <p>Next to docker-compose.yml. A backup is made automatically before the new version changes the database.</p>
          <Code>docker compose pull && docker compose up -d</Code>
          <p>When a release adds a setting, get the newest compose file too (your .env and override stay):</p>
          <Code>curl -O https://raw.githubusercontent.com/Hampter-0/AeroStat/main/deploy/docker-compose.yml</Code>
        </Guide>
        <Guide title="Backups and restoring">
          <p>
            Backups are made every day and before each update, under <strong>System → Backups</strong>. Restore from the
            server:
          </p>
          <Code>docker compose exec -it backend aerostat cli</Code>
          <p>
            Pick <code>restore</code>, then <code>docker compose restart backend</code>.
          </p>
        </Guide>
      </section>

      <section className="manage-panel">
        <h2>When something goes wrong</h2>
        <Guide title="Everyone is locked out, or the only admin lost access">
          <p>From the server, the CLI can fix it without signing in:</p>
          <Code>docker compose exec -it backend aerostat cli</Code>
          <p>
            <code>reset-password</code>, <code>reset-2fa</code>, <code>remove-passkeys</code>,{' '}
            <code>enable-password-login</code>, <code>set-email</code> or <code>create-admin</code>.
          </p>
        </Guide>
        <Guide title="The authenticator app stopped working for everyone">
          <p>SECRET_KEY changed or went missing. Put the old key back, or reset two-factor for each user with the CLI.</p>
        </Guide>
        <Guide title="Passkeys stopped working">
          <p>The status page address changed. Set it back, or have everyone add their passkeys again.</p>
        </Guide>
        <Guide title="Every visitor has the same IP, or a Cloudflare address">
          <p>The proxy doesn’t pass the visitor’s address. Use X-Forwarded-For $remote_addr in nginx, and the Cloudflare setup above when Cloudflare is in front.</p>
        </Guide>
        <Guide title="Uploading a logo or backup fails">
          <p>The proxy refuses big requests. Raise client_max_body_size in nginx; behind Cloudflare’s free plan the limit is 100 MB.</p>
        </Guide>
        <Guide title="Services show as down but work in the browser">
          <p>
            The check runs from the server, not from your browser. Check the URL and the expected status codes on the service,
            and use Check now. A firewall or DNS on the server can give a different result than your own computer.
          </p>
        </Guide>
        <p className="field-hint help-more">
          More in the{' '}
          <a href={DOCS} target="_blank" rel="noreferrer">
            docs
          </a>
          , or ask on Discord.
        </p>
      </section>
    </div>
  )
}
