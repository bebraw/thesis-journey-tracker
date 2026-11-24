# Setup

This guide covers the full local setup flow for running Thesis Journey Tracker for the first time.

## Prerequisites

- Node.js `24.21.0` LTS via [`.nvmrc`](../.nvmrc) (`nvm install && nvm use`)
- npm
- A Cloudflare account with Wrangler access

## 1. Install Dependencies

```bash
npm ci
npm run types:generate
```

The type generation step writes the checked-in Worker runtime declarations to [`worker-configuration.d.ts`](../worker-configuration.d.ts), including the current D1 binding types from [`wrangler.toml`](../wrangler.toml). Re-run it whenever the Worker bindings change.

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

On Windows PowerShell, use:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Set these values in `.dev.vars`:

- `SESSION_SECRET`: at least 32 random bytes used to sign auth cookies
- `APP_ENCRYPTION_SECRET`: a different value of at least 32 random bytes used to encrypt stored application settings
- `REPLACE_IMPORT_ENABLED`: optional, set to `1` only when you intentionally want to allow full replacement imports for recovery work

Example:

```env
SESSION_SECRET=change-this-to-a-long-random-secret
APP_ENCRYPTION_SECRET=change-this-to-a-different-long-random-secret
# REPLACE_IMPORT_ENABLED=1
```

Generate each value independently with `openssl rand -base64 32` or an equivalent cryptographically secure password generator. The app rejects missing, short, placeholder, or reused secret values.

Meeting timestamps are stored in UTC. Dashboard timestamps and one-off meeting forms use `Europe/Helsinki`; repeating meetings use the IANA timezone chosen in the student details. See [agent access](./agent-access.md) for MCP setup and internal meeting schedules.

## 4. Apply Migrations

```bash
npm run db:migrate
```

This applies the SQL files in [`migrations/`](../migrations) to Wrangler's local D1 state for the configured `thesis_tracker_db` binding.

## 5. Create the first administrator

On a new installation, create your own named editor account in local D1. On an upgrade, keep using your existing login. Migration `0008` promotes the sole legacy editor to administrator and supervisor when scoped access has not yet been configured. Verify the result with the lookup below.

```bash
npm run account:create -- --name "Advisor" --role editor
```

Look up the account's immutable ID and confirm the name.

```bash
npx wrangler d1 execute thesis_tracker_db --local --command "SELECT id, name, role, is_admin, can_supervise FROM app_users ORDER BY id"
```

If both flags are already `1` on your account, sign in with your existing password. If the database still needs its first administrator, replace `VERIFIED_ID` with the selected active editor’s numeric ID in the command below. Verify the returned ID and name.

```bash
npx wrangler d1 execute thesis_tracker_db --local --command "UPDATE app_users SET is_admin = 1, can_supervise = 1, session_version = session_version + 1 WHERE id = VERIFIED_ID AND role = 'editor' AND disabled_at IS NULL AND NOT EXISTS (SELECT 1 FROM app_users WHERE is_admin = 1 AND disabled_at IS NULL) RETURNING id, name"
```

Sign in and open **More → Manage access** to create accounts, grant rights, reset passwords, and assign or transfer lead supervision. An editor can update assigned theses. A supervisor can also create a thesis and manage its advisors. Read-only accounts can review the full record for each assigned thesis, including internal notes.

Anyone with a login can open **More → My account**, enter an available username and select **Save username**. Use the new name with your existing password the next time you sign in. The browser where you made the change stays signed in. Other browsers will ask you to sign in again. Your permissions, thesis assignments and agent tokens stay with your account.

To remove an account, transfer any active or archived theses it supervises, then disable it. Disabling revokes its sessions and agent tokens and removes its advisor assignments. From the disabled account, choose **Delete account → Permanently delete account** to remove the login and its tokens. Student records, meeting notes and phase history are preserved. Keep at least one active administrator.

A replacement login with the same name gets a new account ID and starts with no assignments. An older JSON backup that references the deleted ID will require reconciliation before import. A full D1 recovery copy includes the original accounts and assignments.

The command prompts twice without echoing the password. Passwords must contain at least 15 characters. For non-interactive automation, pass `--password-stdin` and supply exactly one line from a secret manager; never place the password in command arguments.

`account:create` requires an available username. To recover an existing account or upgrade an older password hash, look up and verify its immutable ID using the query above. Replace `VERIFIED_ID` with that number. Use the same database for the lookup and reset.

```bash
npm run account:reset-password -- --id VERIFIED_ID
```

The reset signs the account out of every browser and revokes its agent tokens.

## 6. Optionally Load Sample Data

If you want a ready-made local dataset for trying the dashboard, import/export, and reports:

```bash
npm run db:seed:sample
```

This command only targets Wrangler's local D1 state and is safe to re-run because the sample inserts are idempotent. Assign the sample theses to your supervisor account in **Manage access** to see them on your dashboard.

## 7. Start The App

Run the local setup doctor before starting the app:

```bash
npm run doctor:local
```

It checks the active Node version, `.dev.vars`, the `DB` binding, local D1 tables, and whether at least one login account exists. The script is intentionally cross-platform and works from Windows PowerShell, Windows Command Prompt, macOS, and Linux shells.

```bash
npm run dev
```

Open the local URL shown by Wrangler, usually `http://127.0.0.1:8787`.

## First Run Checklist

- If the app cannot start, make sure `database_id` is set in [`wrangler.toml`](../wrangler.toml).
- If the app returns `500` locally, keep `npm run dev` open and read the terminal error. Localhost 500 responses also include the thrown error message and stack trace; deployed production responses intentionally keep this hidden.
- If setup still fails after following the steps, run `npm run doctor:local` and fix the first reported error before trying the browser again.
- If login fails, confirm that `app_users` contains at least one account and that `.dev.vars` has the expected `SESSION_SECRET`.
- If you use `npm run e2e` or `npm run lighthouse`, keep the seeded `Advisor` account in the e2e database unchanged unless you also update the hardcoded test credentials.
- If the schema is out of date, run `npm run db:migrate` again.

## Docker Backup Setup

Docker is a useful fallback when host Node versions, Windows shell differences, or Wrangler local state are hard to diagnose. The image runs the same Wrangler dev server as the normal setup, but binds it to `0.0.0.0` so the host can reach it through a published port.
The image pins its Node base image by digest and owns the development workspace as the unprivileged `node` user, so Wrangler and the documented npm commands do not run as root.

Build the image:

```bash
docker build -t thesis-journey-tracker .
```

Create a named volume for Wrangler's local D1 state:

```bash
docker volume create thesis-journey-tracker-state
```

Create `.dev.vars` on the host if you have not already:

```bash
cp .dev.vars.example .dev.vars
```

On Windows PowerShell:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Set strong, independent `SESSION_SECRET` and `APP_ENCRYPTION_SECRET` values in `.dev.vars` before continuing.

Apply migrations inside the container:

```bash
docker run --rm \
  -v thesis-journey-tracker-state:/app/.wrangler \
  -v "$PWD/.dev.vars:/app/.dev.vars:ro" \
  thesis-journey-tracker npm run db:migrate
```

On Windows PowerShell:

```powershell
docker run --rm `
  -v thesis-journey-tracker-state:/app/.wrangler `
  -v "${PWD}/.dev.vars:/app/.dev.vars:ro" `
  thesis-journey-tracker npm run db:migrate
```

Create the first editor account:

```bash
docker run --rm -it \
  -v thesis-journey-tracker-state:/app/.wrangler \
  -v "$PWD/.dev.vars:/app/.dev.vars:ro" \
  thesis-journey-tracker npm run account:create -- --name "Advisor" --role editor
```

On Windows PowerShell:

```powershell
docker run --rm -it `
  -v thesis-journey-tracker-state:/app/.wrangler `
  -v "${PWD}/.dev.vars:/app/.dev.vars:ro" `
  thesis-journey-tracker npm run account:create -- --name "Advisor" --role editor
```

Use the first-administrator commands in step 5 inside the same container and volume. Run the setup doctor:

```bash
docker run --rm \
  -v thesis-journey-tracker-state:/app/.wrangler \
  -v "$PWD/.dev.vars:/app/.dev.vars:ro" \
  thesis-journey-tracker npm run doctor:local
```

Start the app:

```bash
docker run --rm \
  -p 127.0.0.1:8787:8787 \
  -v thesis-journey-tracker-state:/app/.wrangler \
  -v "$PWD/.dev.vars:/app/.dev.vars:ro" \
  thesis-journey-tracker
```

On Windows PowerShell:

```powershell
docker run --rm `
  -p 127.0.0.1:8787:8787 `
  -v thesis-journey-tracker-state:/app/.wrangler `
  -v "${PWD}/.dev.vars:/app/.dev.vars:ro" `
  thesis-journey-tracker
```

Open <http://127.0.0.1:8787>. The explicit host address keeps the development server off other host interfaces. To reset the containerized local database, remove the named volume and repeat the migration and account steps:

```bash
docker volume rm thesis-journey-tracker-state
```

## Related Docs

- [development.md](./development.md)
- [deployment.md](./deployment.md)
- [project-structure.md](./project-structure.md)
