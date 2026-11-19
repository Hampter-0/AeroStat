# Changelog

What changed in each release. The GitHub release for a version shows its section here; a version without a section falls back to the commit messages.

Add a section per release, newest first, with the version as the heading (`## 1.2.3`). Use `###` headings inside it, for example New, Fixes and Changes.

## 0.28.3

### Fixes

- The users table stays a table on a phone and scrolls sideways, like the activity log, instead of turning into cards that pushed the page wider than the screen.
- The last sign-in date has room again and no longer runs into the Edit button.

## 0.28.2

### Fixes

- The Admin, Owner, You, Suspended and role badges, Current in the version history and the accent colour preview have the new badge look.
- The users table fits between 760 and 1100 pixels wide again; the Edit button no longer falls off the right edge.

## 0.28.1

### Changes

- Incident badges, notices and icons follow the severity, the same in the panel and on the status page: minor is yellow, major orange and only critical red. Resolved is green.
- Maintenance is blue while planned or in progress, green when completed and grey when cancelled.
- Badges have the new look: slightly rounded, with a soft background and border in their colour.
- Incident titles on the status page are plain text again instead of always orange.
- New screenshots in the README.

## 0.28.0

### Changes

- The panel has a new look: a top bar with the status page link, theme and an account menu, and a sidebar with groups you can fold away (Status page, People, System). On a phone the sidebar slides in from the menu button.
- Bigger text, fields and buttons, rounder cards, and tab bars for Settings, System, Profile and the Activity filters.
- The status page uses the same colours, with rounder cards and the Status, Incidents, Maintenance and Contact links as a tab bar.
- Your accent colour from Settings is still used for buttons, links and the active tab.

## 0.27.3

### New

- Every service on the status page shows the response time of its last check next to its status, like "Operational · 102 ms".
- Hovering a day in the uptime bars shows that day's average response time. Days from before the update get it too, since the backend rebuilds the history when it starts.

## 0.27.2

### Changes

- The footer of the status page says "Powered by AeroStat" with a link to aerostatus.nl, instead of repeating the site name.
- `COMPOSE_PROFILES=postgres` in `.env` starts the bundled Postgres, so `docker compose pull && docker compose up -d` (the update command the panel copies) also updates Postgres. Leave it empty when you use your own Postgres.

### Updating

Using the Postgres that comes with AeroStat? Add this line to your `.env`, or `docker compose pull` keeps skipping the Postgres image:

```ini
COMPOSE_PROFILES=postgres
```

## 0.27.1

### Changes

- The documentation moved to [docs.aerostatus.nl](https://docs.aerostatus.nl). The README is shorter and links to it, and the Help page in the panel has a Docs link.
- The `.env.example` in the root of the repository is for development; installing with Docker uses `deploy/.env.example` as before.

## 0.27.0

### Changes

- Admin is now a switch on the user instead of a role. Admins have full access and get the crown in the users list; roles only hold permissions.
- On update, everyone who had a super user role becomes an admin. A super user role without permissions is removed, roles with permissions stay.

### New

- Suspend a user from their user page: they are signed out right away, can't sign in and get no notifications. Only the owner can suspend an admin, and nobody can suspend themselves or the owner.
- `unsuspend` in the CLI lets a suspended account sign in again, and `users` shows who is suspended.
- `create-admin` for an existing account also lifts a suspension.
