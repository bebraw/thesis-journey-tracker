# Setup

This guide covers the full local setup flow for running Thesis Journey Tracker for the first time.

## Prerequisites

- Node.js 20 or newer
- npm
- A Cloudflare account with Wrangler access

## 1. Install Dependencies

```bash
npm install
```

## 2. Create A D1 Database

Create the database once:

```bash
npx wrangler d1 create thesis_tracker_db
```

Wrangler will return a `database_id`. Copy that value into [`wrangler.toml`](../wrangler.toml):

```toml
[[d1_databases]]
binding = "DB"
database_name = "thesis_tracker_db"
database_id = "YOUR_DATABASE_ID"
migrations_dir = "migrations"
```

This command creates the Cloudflare D1 database for the project configuration. Local development and `npm run db:migrate` then use Wrangler's local D1 state while pointing at that configured database binding.

## 3. Configure Local Secrets

Create your local environment file:

```bash
cp .dev.vars.example .dev.vars
```

Set these values in `.dev.vars`:

- `SESSION_SECRET`: a long random string used to sign auth cookies
- `REPLACE_IMPORT_ENABLED`: optional, set to `1` only when you intentionally want to allow full replacement imports for recovery work

Example:

```env
SESSION_SECRET=change-this-to-a-long-random-secret
# REPLACE_IMPORT_ENABLED=1
```

## 4. Apply Migrations

```bash
npm run db:migrate
```

This applies the SQL files in [`migrations/`](../migrations) to Wrangler's local D1 state for the configured `thesis_tracker_db` binding.

## 5. Create At Least One Login Account

Create an editor account in D1:

```bash
npm run account:create -- --name "Advisor" --password "change-this-editor-password" --role editor
```

Optional readonly account:

```bash
npm run account:create -- --name "Professor" --password "change-this-readonly-password" --role readonly
```

If you are upgrading an older local setup and still have `APP_USERS_JSON` or `APP_PASSWORD` in `.dev.vars`, the app can bootstrap those values into D1 on first request after the new migration is applied. After that, remove the old auth env vars.

## 6. Start The App

```bash
npm run dev
```

Open the local URL shown by Wrangler, usually `http://127.0.0.1:8787`.

## First Run Checklist

- If the app cannot start, make sure `database_id` is set in [`wrangler.toml`](../wrangler.toml).
- If login fails, confirm that `app_users` contains at least one account and that `.dev.vars` has the expected `SESSION_SECRET`.
- If you use `npm run e2e` or `npm run lighthouse`, keep the seeded `Advisor` account in the e2e database unchanged unless you also update the hardcoded test credentials.
- If the schema is out of date, run `npm run db:migrate` again.

## Related Docs

- [development.md](./development.md)
- [deployment.md](./deployment.md)
- [project-structure.md](./project-structure.md)
