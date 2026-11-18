# Changelog

What changed in each release. The GitHub release for a version shows its section here; a version without a section falls back to the commit messages.

Add a section per release, newest first, with the version as the heading (`## 1.2.3`). Use `###` headings inside it, for example New, Fixes and Changes.

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
