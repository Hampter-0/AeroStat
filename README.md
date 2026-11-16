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

    client_max_body_size 3m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

`client_max_body_size` allows logo and avatar uploads; nginx stops anything over 1 MB by default. Use `$remote_addr` rather than `$proxy_add_x_forwarded_for`, so a visitor can't send a made-up IP. Without a proxy in front, the IP-based sign-in limit can be bypassed this way; the per-account limit still applies.

## Discord notifications

In the panel under **Settings → Notifications**, paste a Discord webhook URL (in Discord: Server settings → Integrations → Webhooks → New Webhook → Copy Webhook URL) and pick which events to post:

- a service goes down (after two failed checks in a row) or comes back up, with how long it was down
- an incident is posted, updated or resolved
- maintenance is planned, starts, ends or is cancelled

Set the status page address there too, so messages link to the incident or maintenance. **Send test message** checks that everything arrives. Only real Discord webhook URLs are accepted, and the saved URL is never shown in full again.

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
| `LOGIN_MAX_FAILURES_PER_IP` | `10` | Failed sign-ins from one IP before a block |
| `LOGIN_MAX_FAILURES_PER_ACCOUNT` | `30` | Failed sign-ins on one account before a block |
| `LOGIN_LOCKOUT_MINUTES` | `15` | How long a block lasts |
| `UPDATE_CHECK` | `true` | Show people who can view System when a newer release is out |
| `SMTP_HOST` | | Mail server for email notifications. Empty turns email off |
| `SMTP_PORT` | `465` or `587` | Mail server port, follows `SMTP_ENCRYPTION` |
| `SMTP_ENCRYPTION` | `starttls`, or `tls` on port 465 | `tls`, `starttls` or `none` |
| `SMTP_USERNAME` | | Mail server login |
| `SMTP_PASSWORD` | | Mail server password. Never shown in the panel |
| `SMTP_FROM_ADDRESS` | `SMTP_USERNAME` | Address emails are sent from |
| `SMTP_FROM_NAME` | Site name | Name emails are sent from |
| `RUST_LOG` | `info` | Backend log level |

## Command line

The backend image includes an interactive CLI for tasks that need server access:

```bash
docker compose exec -it backend aerostat cli
```

It can run migrations, create an admin, list accounts, reset a password (by username or email) and lift a sign-in block. Single commands also work:

```bash
docker compose exec -it backend aerostat create-admin --username admin
```

## Updating

```bash
docker compose pull
docker compose --profile postgres up -d
```

Leave out `--profile postgres` if you use your own database. Database migrations run automatically on start.

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

Everything worth keeping is in Postgres. With the bundled database:

```bash
docker compose exec postgres pg_dump -U aerostat aerostat > aerostat.sql
```

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
