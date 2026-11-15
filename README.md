# AeroStat

A self-hosted status page. AeroStat checks your services over HTTP(S), shows their uptime per day for the last 60 days, and lets you post incidents and planned maintenance from a small admin panel.

- Public status page with daily uptime bars, incidents and maintenance
- Admin panel at `/manage`: services and groups, incidents, maintenance, branding, users with permissions, activity log
- Light and dark mode, visitor-chosen timezone
- Rust backend (Axum, Postgres, Redis) and a Next.js frontend

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

The status page is now on `http://your-server:3000` and the panel on `http://your-server:3000/manage`. Add your services under **Services**.

### Using your own Postgres

Leave out `--profile postgres` and point `DATABASE_URL` at your database. For a Postgres on the same server, use `host.docker.internal` as the host:

```env
DATABASE_URL=postgres://aerostat:secret@host.docker.internal:5432/aerostat
```

Postgres must accept connections from the Docker network. In `postgresql.conf` set `listen_addresses` to include the Docker bridge address (for example `listen_addresses = 'localhost,172.17.0.1'`), and in `pg_hba.conf` allow the Docker subnet:

```
host  aerostat  aerostat  172.16.0.0/12  scram-sha-256
```

AeroStat creates its own tables on first start. The database and user must exist already.

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

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

Use `$remote_addr` rather than `$proxy_add_x_forwarded_for`, so a visitor can't send a made-up IP. Without a proxy in front, the IP-based sign-in limit can be bypassed this way; the per-account limit still applies.

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

Pushing a tag like `v1.0.0` builds `hampternom/aerostat-backend` and `hampternom/aerostat-frontend` for amd64 and arm64 and pushes them to Docker Hub with the tags `1.0.0`, `1.0` and `latest`. The workflow needs a repository secret `DOCKERHUB_TOKEN` (a Docker Hub access token with read and write access).
