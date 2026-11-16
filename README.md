<div align="center">

<img src="frontend/public/brand/logo.svg" alt="AeroStat logo" width="120" />

# AeroStat

[![Rust](https://img.shields.io/badge/Rust-1.80%2B-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Axum](https://img.shields.io/badge/Axum-0.7-6E4A7E)](https://github.com/tokio-rs/axum)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker pulls](https://img.shields.io/docker/pulls/hampternom/aerostat-backend?logo=docker&logoColor=white)](https://hub.docker.com/r/hampternom/aerostat-backend)
[![License](https://img.shields.io/github/license/Hampter-0/AeroStat?color=blue)](https://github.com/Hampter-0/AeroStat/blob/main/LICENSE)

**A self-hosted status page with uptime monitoring, incidents and maintenance.**

AeroStat checks your services over HTTP(S), shows their uptime per day for the last 60 days,
and lets you post incidents and planned maintenance from a small admin panel.

Runs with Docker Compose next to Postgres and Redis, and is configured with a single `.env` file.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/status-page.png" />
  <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/status-page-light.png" />
  <img src="docs/screenshots/status-page.png" alt="AeroStat status page" width="720" />
</picture>

</div>

## Features

- Public status page with daily uptime bars, incidents and maintenance
- Admin panel at `/manage`: services and groups, incidents, maintenance, branding, users and roles with fine-grained permissions, activity log
- Sign in with a password or a passkey, see and sign out your sessions
- Light and dark mode, visitor-chosen timezone
- Public JSON status API and SVG status badges
- Discord and email notifications when a service goes down or comes back, and for incidents and maintenance
- Link previews for Discord, Slack and social media that show the live status, incident or maintenance
- Rust backend (Axum, Postgres, Redis) and a Next.js frontend

## Screenshots

<table>
  <tr>
    <td><img src="docs/screenshots/dashboard.png" alt="Admin dashboard with response times" /></td>
    <td><img src="docs/screenshots/incident.png" alt="Incident with its update timeline" /></td>
  </tr>
  <tr>
    <td align="center">Admin dashboard</td>
    <td align="center">Incident timeline</td>
  </tr>
</table>

## Install with Docker

You need Docker with the Compose plugin. Everything runs from two files.

```bash
mkdir aerostat && cd aerostat
curl -O https://raw.githubusercontent.com/Hampter-0/AeroStat/main/deploy/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/Hampter-0/AeroStat/main/deploy/.env.example
```

Open `.env` and set at least:

- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`: generate one with `openssl rand -base64 32`
- `DB_PASSWORD`, and the same password in `DATABASE_URL`
- `SECRET_KEY`: generate one with `openssl rand -hex 32`. Optional, but needed for two-factor sign-in with an authenticator app

Keep a copy of `.env` somewhere safe, next to your backups (see [Backups](#backups)).

Start it with the bundled Postgres:

```bash
docker compose --profile postgres up -d
```

Create the first admin account:

```bash
docker compose exec -it backend aerostat create-admin --username admin
```

The status page is now on `http://your-server:3000` and the panel on `http://your-server:3000/manage`. Add your services under **Services**. Port 3000 taken already? Set `AEROSTAT_PORT` in `.env` to a free port; the backend, Redis and Postgres don't use any ports on the server.

### Using your own Postgres

Leave out `--profile postgres` and point `DATABASE_URL` at your own database. AeroStat creates its tables on first start, but the database and user must exist. With `psql` as a superuser:

```sql
CREATE USER aerostat WITH PASSWORD 'a-long-random-password';
CREATE DATABASE aerostat OWNER aerostat;
```

How AeroStat reaches the database depends on where Postgres runs.

**Postgres in another Docker Compose project** (for example next to pgAdmin). Join AeroStat's backend to that project's network with a `docker-compose.override.yml` next to `docker-compose.yml`; Compose reads it automatically:

```yaml
services:
  backend:
    networks:
      - default
      - postgresql

networks:
  postgresql:
    external: true
    name: postgresql_default
```

Find the network name with `docker network ls`, and use the Postgres container name as the host:

```env
DATABASE_URL=postgres://aerostat:a-long-random-password@postgresql-db-1:5432/aerostat
```

**Postgres installed directly on the server.** Use `host.docker.internal` as the host:

```env
DATABASE_URL=postgres://aerostat:a-long-random-password@host.docker.internal:5432/aerostat
```

Postgres must then accept connections from the Docker network. In `postgresql.conf` set `listen_addresses` to include the Docker bridge address (for example `listen_addresses = 'localhost,172.17.0.1'`), and in `pg_hba.conf` allow the Docker subnet:

```
host  aerostat  aerostat  172.16.0.0/12  scram-sha-256
```

### Redis

Redis runs as part of the compose file and needs no setup. It only holds data that AeroStat rebuilds from Postgres on every start (the daily uptime bars) and short-lived sign-in counters, so it keeps nothing on disk.

## Behind a reverse proxy

Put AeroStat behind a reverse proxy for HTTPS. Set `AEROSTAT_BIND=127.0.0.1` in `.env` so port 3000 is only reachable through the proxy. Only the frontend is published; the backend stays on the internal Docker network.

The proxy has to pass the original host, protocol and client IP. The sign-in cookie is marked `Secure` when `X-Forwarded-Proto` is `https`, and the client IP is used to block repeated failed sign-ins.

**Caddy** does all of this by default:

```
status.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

**nginx**:

```nginx
server {
    listen 443 ssl;
    server_name status.example.com;
    # ssl_certificate ... / ssl_certificate_key ...

    client_max_body_size 2g;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

`client_max_body_size` allows uploads of logos, avatars and backups; nginx stops anything over 1 MB by default. Use `$remote_addr` as shown, so the proxy replaces any `X-Forwarded-For` a visitor sends and AeroStat sees the real IP.

AeroStat only trusts `X-Forwarded-For` when the connection comes from a private address, like a proxy on the same server or Docker network. A visitor who connects straight to port 3000 from the internet is seen by their real address, whatever header they send. A visitor on your own local network could still send a made-up header, so for anything beyond a home lab run AeroStat behind a proxy and set `AEROSTAT_BIND=127.0.0.1`.

### Cloudflare in front of your proxy

Behind Cloudflare, your proxy sees Cloudflare's address instead of the visitor's, so every visitor would share a few IPs. Let the proxy take the visitor's IP from Cloudflare, and only from Cloudflare's own addresses, so nobody can fake it by going around Cloudflare.

**nginx**: add this to the `http` block, for example in `/etc/nginx/conf.d/cloudflare.conf`, and keep `X-Forwarded-For $remote_addr` in the AeroStat site. Take the current ranges from [cloudflare.com/ips](https://www.cloudflare.com/ips/):

```nginx
real_ip_header CF-Connecting-IP;
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
set_real_ip_from 2c0f:f248::/32;
```

**Caddy**: tell it to trust Cloudflare and read its header. In the global options at the top of the Caddyfile:

```
{
    servers {
        trusted_proxies static 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22 2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32
        client_ip_headers CF-Connecting-IP
    }
}

status.example.com {
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-For {client_ip}
    }
}
```

Check it under **Profile → Sessions**: your own IP should show there, not a Cloudflare address like `172.68.x.x` or `162.158.x.x`. Cloudflare's free plan accepts uploads up to 100 MB, so upload bigger backups straight to the server instead.

### TRUSTED_PROXY_HOPS

AeroStat reads the client IP from the last `X-Forwarded-For` entry. With the setups above that is the only entry, so leave `TRUSTED_PROXY_HOPS` at 1. Only when a proxy adds to the header instead of replacing it (nginx with `$proxy_add_x_forwarded_for`) behind another proxy that does the same, set it to the number of proxies in that chain. Prefer the setups above: with an adding chain, someone who reaches your server around the first proxy can still fake an IP.

## Discord notifications

In the panel under **Settings → Notifications**, paste a Discord webhook URL (in Discord: Server settings → Integrations → Webhooks → New Webhook → Copy Webhook URL) and pick which events to post:

- a service goes down (after two failed checks in a row) or comes back up, with how long it was down
- an incident is posted, updated or resolved
- maintenance is planned, starts, ends or is cancelled

Set the status page address under **Settings → General**, so messages link to the incident or maintenance. **Send test message** checks that everything arrives. Only real Discord webhook URLs are accepted, and the saved URL is never shown in full again.

## Email notifications

Panel users can get the same notifications by email. Add your mail server to `.env`:

```env
SMTP_HOST=mail.example.com
SMTP_PORT=465
SMTP_ENCRYPTION=tls
SMTP_USERNAME=noreply@example.com
SMTP_PASSWORD=your-password
SMTP_FROM_ADDRESS=noreply@example.com
```

Restart with `docker compose up -d`. People with the Email settings permission see the settings under **System → Email** and can send a test email there; the password is never shown. Each user then picks their notifications on their **Profile**, and only gets the ones their roles let them see: services, incidents or maintenance. Everyone gets their own email, so addresses are never shared.

## Passkeys

Panel users can sign in with a passkey instead of a password: Windows Hello, Face ID, Touch ID, a phone or a security key. Add one under **Profile → Security keys**. A passkey only works on the domain it was made for, so set the status page address under **Settings → General** first (for example `https://status.example.com`). If that address ever changes, everyone has to add their passkeys again.

Someone with a passkey can turn password sign-in off on their profile. Signing in with a passkey never counts towards the sign-in block.

## Two-factor sign-in

Panel users can ask for a code after their password under **Profile → Two-factor sign-in**: from an authenticator app (1Password, Bitwarden, Google Authenticator, Aegis and so on) or by email. Turning on the first method gives 10 recovery codes, each one works once when the app or email is out of reach.

The authenticator app needs `SECRET_KEY` in `.env`, which encrypts the app secrets in the database:

```bash
openssl rand -hex 32
```

Keep this key with your backups. If it changes or gets lost, everyone has to set up their app again. Email codes need email to be set up and work without the key.

Someone who can edit users can require two-factor sign-in for a user. That user then has to turn on a method, or sign in with passkeys only (password sign-in off), before they can use the panel. If someone loses their phone, open them under **Users** and use **Reset two-factor**.

## Forgot password

The sign-in page shows **Forgot password?** when email is set up and the status page address is filled in under **Settings → General**. People get a link that works once, for 30 minutes, and are signed out everywhere after they choose a new password. Two-factor sign-in still applies. The answer is the same for addresses that have no account, so the page can't be used to find out who has one.

Without email, an admin can set a new password on the user's page, or from the server:

```bash
docker compose exec -it backend aerostat cli
```

and pick `reset-password`.

## Status API and badges

Every AeroStat site has a small public API, so other sites and tools can show your status. Both endpoints allow cross-origin requests and are cached for a short time.

**`GET /api/status`** returns the overall status, every service and anything ongoing:

```json
{
  "status": "operational",
  "last_checked": "2026-11-15T16:40:12Z",
  "services": [
    { "id": "website", "name": "Website", "group": "Websites", "status": "online", "last_checked": "2026-11-15T16:40:12Z" }
  ],
  "ongoing_incidents": [],
  "maintenance_in_progress": []
}
```

`status` is one of `operational`, `degraded` (an incident is ongoing), `outage` (a service is down), `maintenance` or `no_services`. A service is `online`, `offline` or `pending` (not checked yet). Each incident and maintenance lists the ids of the `services` it affects. Check URLs are never included.

**`GET /api/status?service=<id>`** returns one service, with only the incidents and maintenance that affect it:

```json
{
  "id": "contact-api",
  "name": "Contact API",
  "group": "APIs",
  "status": "online",
  "last_checked": "2026-11-15T16:40:12Z",
  "ongoing_incidents": [],
  "maintenance_in_progress": []
}
```

An unknown id returns `404` with `{"error": "Unknown service"}`. The id is the last part of the service's URL in the panel (`/manage/services/contact-api`) and is also listed in `/api/status`.

For example, to show a notice on your own site when a service is down:

```js
const res = await fetch('https://status.example.com/api/status?service=contact-api')
const service = await res.json()
if (service.status === 'offline') {
  // show "the contact form is temporarily unavailable"
}
```

**`GET /api/badge`** returns an SVG badge for a README or website:

```markdown
![Status](https://status.example.com/api/badge)
![Website](https://status.example.com/api/badge?service=website)
![Status](https://status.example.com/api/badge?label=my%20app)
```

`service` picks one service by its id (shown in the panel's service URL and in `/api/status`), and `label` replaces the text on the left.

## Troubleshooting

**A service shows as down with status 403, but it works in your browser.** The site is probably behind Cloudflare or another firewall that blocks automated requests. AeroStat identifies itself as `AeroStat/<version> (+https://github.com/Hampter-0/AeroStat)`, which most setups allow. If it is still blocked, add a rule in the firewall that lets your AeroStat server's IP address through.

**A service is down only from AeroStat.** Checks run from inside the backend container. Test from the same network with:

```bash
docker compose exec frontend wget -S -O /dev/null https://example.com
```

## Configuration

All settings go in `.env` next to `docker-compose.yml`. Site name, contact link, colour, logo, favicon, timezone and data retention can also be changed in the panel under **Settings**; the panel value wins.

| Variable | Default | |
| --- | --- | --- |
| `AEROSTAT_VERSION` | `latest` | Image tag to run |
| `AEROSTAT_BIND` | `0.0.0.0` | Address the status page listens on |
| `AEROSTAT_PORT` | `3000` | Port the status page listens on |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | | Required. `openssl rand -base64 32` |
| `DATABASE_URL` | | Required. Postgres connection string |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | `aerostat`, `change_me`, `aerostat` | Bundled Postgres only |
| `SITE_NAME` | `AeroStat` | Default site name |
| `CONTACT_URL` | | Default contact link |
| `PRIMARY_COLOR` | `#1678c2` | Default accent colour |
| `METRICS_RETENTION_DAYS` | `60` | Days of check results to keep |
| `SESSION_DAYS` | `30` | How long a panel sign-in lasts (max 365) |
| `LOGIN_MAX_FAILURES_PER_IP` | `10` | Failed sign-ins from one IP before a block. IPv6 addresses count per /64 block, since one connection gets a whole block |
| `LOGIN_MAX_FAILURES_PER_ACCOUNT` | `30` | Failed sign-ins on one account before new IPs are blocked; IPs that signed in to it in the last 90 days still get in |
| `LOGIN_LOCKOUT_MINUTES` | `15` | How long a block lasts |
| `UPDATE_CHECK` | `true` | Show people who can view System when a newer release is out |
| `SECRET_KEY` | | Encrypts authenticator app secrets. `openssl rand -hex 32`. Without it only email codes work |
| `SMTP_HOST` | | Mail server for email notifications. Empty turns email off |
| `SMTP_PORT` | `465` or `587` | Mail server port, follows `SMTP_ENCRYPTION` |
| `SMTP_ENCRYPTION` | `starttls`, or `tls` on port 465 | `tls`, `starttls` or `none` |
| `SMTP_USERNAME` | | Mail server login |
| `SMTP_PASSWORD` | | Mail server password. Never shown in the panel |
| `SMTP_FROM_ADDRESS` | `SMTP_USERNAME` | Address emails are sent from |
| `SMTP_FROM_NAME` | Site name | Name emails are sent from |
| `BACKUP_DIR` | `/data/backups` | Where backups are stored |
| `PG_DUMP_PATH`, `PG_RESTORE_PATH`, `PSQL_PATH` | `pg_dump`, `pg_restore`, `psql` | The PostgreSQL tools, only needed outside Docker |
| `TRUSTED_PROXY_HOPS` | `1` | Only for proxies that add to `X-Forwarded-For` instead of replacing it, see [TRUSTED_PROXY_HOPS](#trusted_proxy_hops) |
| `RUST_LOG` | `info` | Backend log level |

## Command line

The backend image includes an interactive CLI for tasks that need server access:

```bash
docker compose exec -it backend aerostat cli
```

It can run migrations, create an admin, list accounts, reset a password (by username or email) and lift a sign-in block. For someone who is locked out it can also:

| Command | What it does |
|---|---|
| `reset-2fa` | Turns off the authenticator app and email codes and removes the recovery codes |
| `remove-passkeys` | Removes every passkey of an account and turns password sign-in back on |
| `enable-password-login` | Turns password sign-in back on |
| `set-email` | Changes or removes an email address |
| `backups` | Lists the backups |
| `backup` | Makes a backup now |
| `restore` | Puts a backup back, after backing up the database as it is now |

Each change shows up under Activity. Accounts made with `create-admin` are the owners of the install and get a crown in the users list. Single commands also work:

```bash
docker compose exec -it backend aerostat create-admin --username admin
```

## Updating

```bash
docker compose pull
docker compose --profile postgres up -d
```

Leave out `--profile postgres` if you use your own database. Database migrations run automatically on start.

New releases sometimes add a setting to `.env.example`, like `SECRET_KEY` in 0.12.0. Docker only passes a setting to AeroStat when `docker-compose.yml` lists it, so get the newest compose file too. Your `.env` and `docker-compose.override.yml` stay as they are:

```bash
cp docker-compose.yml docker-compose.yml.bak
curl -O https://raw.githubusercontent.com/Hampter-0/AeroStat/main/deploy/docker-compose.yml
docker compose up -d
```

If you changed `docker-compose.yml` yourself, compare it with the `.bak` copy and move your changes to `docker-compose.override.yml`.

The panel shows the running version at the bottom of the sidebar. When a newer release is out, people with the View system permission see a notice on the dashboard with a link to the release notes and a button that copies the update command. AeroStat checks GitHub for this every six hours and sends nothing about your installation; set `UPDATE_CHECK=false` to turn it off.

AeroStat can't update itself: that would need access to the Docker socket, which is the same as root on your server. If you want automatic updates, run [Watchtower](https://containrrr.dev/watchtower/) next to it, limited to the AeroStat containers:

```yaml
  watchtower:
    image: containrrr/watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --cleanup --interval 21600 aerostat-frontend-1 aerostat-backend-1
```

## Backups

Everything worth keeping is in Postgres. AeroStat backs it up with `pg_dump` into the `backups` volume:

- **Every day** after 03:00 in the site's timezone, keeping the last 7. Change this, or turn it off, under **System → Backups**.
- **Before an update.** When a new version starts for the first time, it backs up the database before changing it. The last 3 are kept.
- **By hand** with **Make a backup now** under **System → Backups**, where you can also download and delete them. Only people with the Backups permission see this; a backup holds everything, password hashes included. Uploading a backup from elsewhere is for super users only, because a backup runs as SQL when it is restored; the CLI warns before restoring an uploaded one.

A backup on the same server is gone when the server is. Download one now and then, or copy the volume elsewhere, and keep a copy of your `.env` with it: without the same `SECRET_KEY` the authenticator apps stop working and everyone has to set them up again.

The volume is called `aerostat_backups`. Find its folder on the server with `docker volume inspect aerostat_backups --format '{{ .Mountpoint }}'` (usually `/var/lib/docker/volumes/aerostat_backups/_data`), or copy every backup next to your compose file:

```bash
docker compose cp backend:/data/backups ./aerostat-backups
```

To keep the backups in a folder of your own instead of a volume, add this to `docker-compose.override.yml`. The folder must be writable for user id 10001:

```yaml
services:
  backend:
    volumes:
      - /srv/aerostat-backups:/data/backups
```

### Restoring

Super users can restore a backup under **System → Backups** with **Restore**, after entering their password. AeroStat first backs up the database as it is now, puts the chosen backup back, and then restarts the backend so newer migrations run; you sign in again afterwards. If anything fails, nothing is changed.

The same works from the server with the CLI, also when you can't sign in:

```bash
docker compose exec -it backend aerostat cli
```

Pick `restore`, then restart the backend so it runs any newer migrations:

```bash
docker compose restart backend
```

A backup from a newer AeroStat can't go back into an older one; update first. The Docker image has the PostgreSQL 17 tools, which work with PostgreSQL 17 and older.

## Development

Requirements: Rust, Node.js 20.9 or newer, Postgres and Redis.

```bash
cp .env.example .env                              # backend settings
cp frontend/.env.local.example frontend/.env.local
cd backend && cargo run                           # API on :3004
cd frontend && npm install && npm run dev         # site on :3000
```

Create an admin with `cargo run -- create-admin --username admin`, or open the CLI with `cargo run -- cli`.

### Releasing images

Pushing a tag like `v1.0.0` builds `hampternom/aerostat-backend` and `hampternom/aerostat-frontend` for amd64 and arm64 on native runners and pushes them to Docker Hub with the tags `1.0.0`, `1.0` and `latest`. The workflow needs a repository secret `DOCKERHUB_TOKEN` (a Docker Hub access token with read and write access).

## License

AeroStat is released under the [MIT License](LICENSE).
