# Thesis Journey Tracker

This project implements a thesis advising dashboard for tracking students through thesis phases, meetings, and supervision logs. Note that I generated the project using GPT-5.4 so expect AI slop! But it works more or less.

## Features

- Password-protected access (single advisor account)
- D1 persistence (students and meeting logs)
- Thesis phase tracking:
  - Planning research
  - Researching
  - First complete draft
  - Editing
  - Draft ready to submit
  - Submitted
- Per-student next meeting date/time (optional)
- Per-student degree type tracking (BSc, MSc, DSc)
- Per-student thesis topic tracking
- Per-student log history:
  - What was discussed
  - Agreed plan / next actions
  - Optional deadline for next step
- Dashboard phase lanes showing how students are distributed across thesis phases
- Seeded test data used only in the isolated E2E environment
- Dark mode
- Reusable server-rendered UI components and authenticated style guide page
- Works locally and on Cloudflare Workers
- Simple server-rendered HTML + on-demand generated Tailwind CSS (no React)

## Tech Stack

- Cloudflare Workers (runtime + hosting)
- Cloudflare D1 (SQLite)
- TypeScript (Worker) + HTML + Tailwind CSS build pipeline

## Project Structure

- `src/worker.ts`: App routes, auth, page rendering, business logic
- `src/reference-data.ts`: Shared phase and degree reference data used across UI and logic
- `src/ui/`: Reusable UI component render helpers and shared Tailwind patterns
- `src/tailwind-input.css`: Tailwind source file
- `.generated/styles.css`: generated/minified Tailwind output served at `/styles.css` during dev, E2E, and deploy
- `migrations/0001_init.sql`: Schema, indexes, and triggers
- `migrations/0002_cleanup_mock_data.sql`: One-time cleanup for legacy mock rows and obsolete settings table
- `migrations/0003_add_degree_type.sql`: Adds persisted student degree type
- `migrations/0004_add_thesis_topic.sql`: Adds persisted thesis topic per student
- `migrations/0005_remove_is_mock_columns.sql`: Removes the legacy `is_mock` columns after test data was isolated to E2E
- `tests/e2e/mock-data.sql`: Seeded test students/logs for isolated E2E runs
- `docs/performance-plan.md`: Current Lighthouse baseline and follow-up performance plan
- `editor-support/vscode-htmlisp/`: VS Code language extension for HTMLisp highlighting
- `wrangler.toml`: Worker + D1 binding config
- `tailwind.config.cjs`: Tailwind scanning + dark mode config
- `.dev.vars.example`: local env variable template

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a D1 database (first time only):

```bash
npx wrangler d1 create thesis_tracker_db
```

3. Copy the returned `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "thesis_tracker_db"
database_id = "YOUR_DATABASE_ID"
migrations_dir = "migrations"
```

4. Configure local secrets:

```bash
cp .dev.vars.example .dev.vars
```

Set these values in `.dev.vars`:

- `APP_PASSWORD`: login password for the dashboard
- `SESSION_SECRET`: long random string used to sign auth session cookies

5. Apply local D1 migrations:

```bash
npm run db:migrate
```

6. Start locally:

```bash
npm run dev
```

Open the local URL shown by Wrangler (typically `http://127.0.0.1:8787`).

Optional: run static type checking:

```bash
npm run typecheck
```

Manual CSS rebuild if you want to force-refresh the generated stylesheet:

```bash
npm run build:css
```

Run unit/integration tests (includes SQL-injection safety tests for form actions):

```bash
npm test
```

Run end-to-end tests:

```bash
npx playwright install chromium
npm run e2e
```

Run Lighthouse performance audits against the authenticated dashboard:

```bash
npm run lighthouse
```

Generated reports are written to `reports/lighthouse/`.
The command also enforces a minimum Lighthouse performance score of `90` for both mobile and desktop runs.

Run the HTMLisp VS Code extension locally:

1. Open `editor-support/vscode-htmlisp` in VS Code
2. Press `F5`
3. Test highlighting in the Extension Development Host

## CI

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Triggered on every push and pull request
- Runs: `npm ci`, `npx playwright install --with-deps chromium`, `npm run typecheck`, `npm test`, `npm run e2e`, `npm run lighthouse`

## Deploy to Cloudflare

1. Authenticate Wrangler:

```bash
npx wrangler login
```

2. Set production secrets:

```bash
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
```

3. Apply migrations to remote D1:

```bash
npm run db:migrate:remote

Wrangler runs the Tailwind build automatically before `dev` and `deploy` via `wrangler.toml`, so the generated CSS does not need to be committed.
```

4. Deploy:

```bash
npm run deploy
```

## Usage Notes

- Add students with degree type, optional thesis topic, and start date. If target submission date is omitted, it defaults to start date + 6 months.
- Use **View & Edit** on a student row to edit details and add/view log entries.
- Filter the Students table by degree type, phase, and meeting status.
- If a next meeting is not known, leave it empty.
- `/style-guide` shows the currently available reusable UI components.
- Seeded test students are not part of your normal workspace and are only loaded into the isolated E2E database.
- Dark mode is controlled directly from the header toggle.
- If you used an older version, run the latest D1 migrations so your schema matches the current app.

## Security Model

- App access is gated behind password login.
- Session is stored in an `HttpOnly`, `Secure`, signed cookie.
- Suitable for private personal use; if needed, this can be upgraded later to Cloudflare Access or SSO.
