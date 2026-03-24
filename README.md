# Thesis Journey Tracker

Thesis Journey Tracker is a private advising dashboard for following students as they move through a thesis process. It is built for small supervision teams: you can keep track of thesis phases, upcoming meetings, thesis topics, and supervision notes in one place, with editor or readonly access per account.

The project is intentionally small and server-rendered. It runs on Cloudflare Workers with D1 for storage, so it stays lightweight while still being easy to deploy.

## Why This Project Exists

- Keep thesis supervision work organized without relying on spreadsheets or scattered notes.
- See where students are in the process at a glance.
- Record meeting outcomes and next steps in a format that is easy to revisit later.

## What You Can Do With It

- Add students with degree type, thesis topic, and timeline information.
- Track each student through thesis phases from planning to submission.
- Store supervision logs with discussion notes, action items, and optional deadlines.
- Follow upcoming meetings from the dashboard.
- Filter the student list by phase, degree type, and meeting status.
- Export or restore the dataset as JSON backups.
- Store automated Cloudflare backups in R2 when deployed with the scheduled backup setup.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create a local D1 database:

```bash
npx wrangler d1 create thesis_tracker_db
```

3. Put the returned `database_id` into [`wrangler.toml`](./wrangler.toml).

4. Create local secrets:

```bash
cp .dev.vars.example .dev.vars
```

5. Apply migrations and create your first account:

```bash
npm run db:migrate
npm run account:create -- --name "Advisor" --password "change-this-password" --role editor
```

6. Start the app:

```bash
npm run dev
```

Wrangler will print the local URL, typically `http://127.0.0.1:8787`.

To add more accounts later, run the same script again with a different `name` and `role`:

```bash
npm run account:create -- --name "Professor" --password "change-this-password" --role readonly
```

By default this writes to the local D1 database. Add `--remote` if you want to create an account in the deployed database instead.

For the full setup flow, see [docs/setup.md](./docs/setup.md).

## Documentation

- [docs/setup.md](./docs/setup.md): local setup, environment variables, and first run
- [docs/development.md](./docs/development.md): scripts, testing, editor support, and day-to-day development notes
- [docs/deployment.md](./docs/deployment.md): CI, production deployment, and security notes
- [docs/project-structure.md](./docs/project-structure.md): tech stack, architecture, and directory map
- [docs/backups.md](./docs/backups.md): automated R2 backups, restore flow, and retention notes
- [docs/performance-plan.md](./docs/performance-plan.md): Lighthouse baseline and performance follow-up plan

## Tech Snapshot

- Cloudflare Workers for runtime and hosting
- Cloudflare D1 for persistence
- TypeScript throughout the app
- HTMLisp for server-rendered views
- Tailwind CSS for styling

## First-Time Reader Notes

- This is a private, password-protected app with lightweight role-based access rather than a multi-tenant SaaS product.
- Auth accounts now live in the D1 database, with a tiny CLI helper for creating editor and readonly users.
- The UI is server-rendered and deliberately simple.
- Seeded mock students are only used in the isolated end-to-end test environment.

If you want to understand how the codebase is organized before diving in, start with [docs/project-structure.md](./docs/project-structure.md).
