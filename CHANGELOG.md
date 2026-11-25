# Changelog

What changed in each release. The GitHub release for a version shows its section here; a version without a section falls back to the commit messages.

Add a section per release, newest first, with the version as the heading (`## 1.2.3`). Use `###` headings inside it, for example New, Fixes and Changes.

## 0.32.1

### Fixes

- The menu button of the status page on phones keeps its size when it turns into a cross.
- The status card on the panel dashboard no longer squeezes its text on narrow screens: **View status page** moves under the text instead.
- The status card says "Your service is online" instead of "1 services, all online".

## 0.32.0

### New

- **Check log** on every service page: the latest 10 checks with **Show more** for older ones, with their time, response time and status. A failed check shows why, and **Details** shows what came back: the status line, useful headers and the start of the page, or the technical error. Details are kept for a week.
- **Test now** on a service runs its check right away and shows the whole result. It is not saved and never sends a notification. You can test the same service once every 10 seconds.
- A "service down" message on Discord and by email links to the check log of that service.
- **Slow response warnings you can tune**: a service counts as slow when 3 of its last 5 checks were slow, so one hiccup stays quiet. Change both under **Settings → Monitoring**, down to 1 of 1 for a warning on every slow check. Per service you can add a fixed limit in ms, or turn the warnings off. Services are checked for this every minute instead of every 5.
- Slow services show **Slower than usual** in yellow on the status page, and their group shows **Slow**.
- **Send test** under **Settings → Notifications** shows how a slow response warning looks on Discord, by email and in your panel.
- **Company name and website** under **Settings → General**: the copyright line on the sign-in page shows your company and links to your own website.
- A page that doesn't exist in the panel shows a "Page not found" page in the panel's style once you're signed in.
- **Try again** button when the status page can't reach the backend.
- A colour picker for the accent colour with a colour field and a hue bar, and a calendar for every date and time field, instead of the browser's own.

### Changes

- Docker hosts have their own permission, **Docker hosts**. Everyone who could change the monitoring settings keeps it.
- Posting an update picks the status from a dropdown, like editing an update.
- The passkey button, soft buttons, the login notice and the focus rings of fields follow your accent colour.
- The phone menu of the status page shows a cross while it is open.
- `COMPOSE_PROFILES` in `.env` can hold `docker` next to `postgres`, so the normal update command also updates the Docker proxy.

### Fixes

- The response time of each service shows on phones again.
- Pull to refresh works on phones again.
- The two buttons on the "Can't reach the server" page have the same height.
- Saving a service, incident or maintenance keeps the form as you saved it, instead of showing the old values (like the check type going back to HTTP) until you refresh.
- An incident or maintenance whose services were all deleted no longer shows an empty "Affected services" row.

## 0.31.1

### Changes

- A Docker container whose health check is still starting is waited for instead of counted as down: no result, no downtime and no message until Docker calls it healthy or unhealthy.

## 0.31.0

### New

- **Docker container checks** without fiddling: start the read-only Docker proxy with `docker compose --profile docker up -d` and pick the container from a list. Add other servers under **Settings → Docker** and test them there. The proxy is in the new `docker-compose.yml`, so download that again to use it.
- More check types: **Ping**, **Docker container**, **PostgreSQL**, **MySQL or MariaDB**, **Redis**, **Minecraft Java**, **Minecraft Bedrock** and **Source games** (CS2, Rust, Garry's Mod and more). The database checks speak a little of the real protocol without a password, so a database that hangs is down even when its port is open. Leave out the port and the usual one is used.
- **Slow response warnings**: when a service answers much slower than usual (100% by default, change it under **Settings → Monitoring**), you get one message on Discord, by email and in the panel, and the status page shows a notice. Services that turn slow at the same moment share one message, named by group or **All**. A second message follows when they are back to normal.
- **Uptime history** under **Incidents → Uptime**, also linked above Live Status: a calendar per month for each service, with the same colours and details as the bars, going back further than 60 days.
- The panel dashboard has a status card and four tiles: services up, average response time, incidents and downtime.

### Changes

- Live Status on the status page is one card with a row per group, like other status pages: open a group to see its services with their uptime and bars.
- Status icons are outline icons in the status colour everywhere: timelines, notices, toasts, the panel lists and the uptime tooltips. Notices on the status page lead with the incident or maintenance title.
- The panel lists of incidents and maintenance name the group, or **All**, instead of every service.
- **Check all now** can be used once every 30 seconds.
- The response time graphs in the panel use the accent colour, like the status page.
- **Powered by** always shows the AeroStat logo, and sits a little further from the time zone picker.
- Borders of cards inside panels are easier to see, in light and dark mode. Rows, cards and the account button no longer get a blue border on hover.
- Links on the status page and the "Back to overview" links use the same style as in the panel.
- The incident, maintenance and uptime history pages have a centred heading with a shorter month range.

### Fixes

- Scrolling past the top of a page no longer drags the whole page and top bar along.

## 0.30.1

### Changes

- When you pick affected services, each group's services sit indented under the group, like the permissions on a role. Ticking the group ticks all of them.

## 0.30.0

### New

- The status page shows a **Response time** graph under Live Status: the average response time of all services or one service, for the last day, week or month. Hover or tap the line to see the time and value. Only checks that were up count.
- **Past incidents** on the status page: the last 7 days, each day with its incidents or "No incidents reported".
- A page that doesn't exist shows a clear "Page not found" page with a way back, on the status page and in the panel.

### Changes

- Minor and major incidents are both yellow, only critical is red: in the uptime bars, badges, notices, panel notifications, Discord, emails and link previews.
- Discord and email notifications name the group, or **All**, when a whole group or every service is affected, like the status page.
- Status icons are a full coloured circle with a white icon everywhere: the timelines, the notices, the panel dashboard and the incident and maintenance lists.
- The panel's incident and maintenance lists show the same status icons as the timeline, and the dashboard icons are centred in their row.
- In the uptime bar tooltips an incident day shows an exclamation mark instead of a cross.
- Cards in the panel no longer get a blue border on hover.

### Fixes

- The exclamation mark in the timeline is centred in Firefox at 100% zoom.
- The logo and favicon hint reads "Using the default." with a full stop.

## 0.29.0

### New

- Panel notifications pop up at the bottom right while you use the panel, instead of collecting in a bell. Notifications that came in while you were away show when you open the panel: the newest three and how many more there were. **Show notifications in the panel** on your profile turns them off.
- When you create an incident or maintenance, tick a whole group or **Select all**. The status page then shows the group name, or **All**, instead of every service.

### Changes

- Colours follow the severity everywhere, also on Discord, in emails and in link previews: minor is yellow, major orange and only critical red. Planned maintenance is yellow, maintenance in progress blue.
- A service that is down while its maintenance is in progress shows **Maintenance** in blue instead of red: on the status page, in its group, in its uptime bar and on the panel dashboard.
- The incident and maintenance timelines on the status page show an icon per status: an alert or wrench while it runs, a clock when planned, a check when done and a cross when cancelled. The icons are centred on the line.
- The panel looks more like Paymenter: a wider sidebar without a border, larger menu text, bolder table headers and links. In light mode the top bar, sidebar and cards are light grey on a white page.
- Separators use a comma instead of a dot.
- The logs no longer have a Pause button; they always stay live.
- On a phone, holding a response time graph on the dashboard shows the value instead of selecting text.

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
