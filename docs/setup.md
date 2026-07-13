# Setup

This guide covers the full local setup flow for running Thesis Journey Tracker for the first time.

## Prerequisites

- Node.js `24.18.0` LTS via [`.nvmrc`](../.nvmrc) (`nvm install && nvm use`)
- npm
- A Cloudflare account with Wrangler access

## 1. Install Dependencies

```bash
npm install
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

The app still runs without Google Calendar credentials. If you want scheduling enabled, collect the Google values below and then save them from `Data Tools`; they will be encrypted before they are stored in D1.

### Optional: Get Google Calendar Integration Values

If you want `/schedule` to read and create Google Calendar events, collect the values like this:

1. Create or choose a Google Cloud project, then enable the Google Calendar API.
   Official guide: [Enable Google Workspace APIs](https://developers.google.com/workspace/guides/enable-apis)

2. Configure the OAuth consent screen in Google Auth Platform.
   Official guide: [Configure OAuth consent](https://developers.google.com/workspace/guides/configure-oauth-consent)

   Notes:
   - If this is only for your own Google Workspace organization, `Internal` is usually the simplest audience choice.
   - If you use `External`, add yourself as a test user before trying to authorize.

3. Create an OAuth client in Google Auth Platform and save the client ID and secret.
   Official guide: [Create access credentials](https://developers.google.com/workspace/guides/create-credentials)

   Use a `Web application` client for this app, because Thesis Journey Tracker stores a server-side `client_secret` together with a long-lived refresh token.

   If you plan to generate the refresh token with Google's OAuth 2.0 Playground, add this authorized redirect URI before creating the client:

   ```text
   https://developers.google.com/oauthplayground
   ```

   You will later paste the OAuth client ID and client secret into the `Google Calendar Credentials` form in `Data Tools`.

4. Generate a refresh token for the same OAuth client.
   Google docs confirm that refresh tokens are returned only for offline access, and if you already authorized without the right settings you may need to re-authorize: [OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)

   Scope to enable:
   - `https://www.googleapis.com/auth/calendar.events`

   This is the only Google Calendar scope the app currently needs. Google documents it as: "View and edit events on all your calendars." Source: [Choose Google Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth)

   A practical way to do this is with Google's OAuth 2.0 Playground:
   - Open <https://developers.google.com/oauthplayground>
   - Click the gear icon and enable `Use your own OAuth credentials`
   - Paste the client ID and client secret from step 3
   - Authorize the scope `https://www.googleapis.com/auth/calendar.events`
   - Exchange the authorization code for tokens
   - Copy the returned refresh token so you can paste it into the `Google Calendar Credentials` form in `Data Tools`

   Do not enable broader Calendar scopes unless the app later grows into calendar sharing, ACL, or full-calendar management features.

5. Pick the calendar ID the app should use.
   Google documents that calendars have IDs, and that `primary` refers to the signed-in user's main calendar:
   - [Calendars and events concept guide](https://developers.google.com/workspace/calendar/api/concepts/events-calendars)
   - [Calendar get reference](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/get)

   You have two common options:
   - Use `primary` for your main calendar
   - Use a shared or secondary calendar ID copied from Google Calendar on the web:
     1. Open Google Calendar in a browser
     2. Go to `Settings and sharing` for the target calendar
     3. Open `Integrate calendar`
     4. Copy `Calendar ID`

   Save that value for the `Google Calendar ID` field in `Data Tools`.

6. Optionally choose the display timezone.
   This is not provided by Google directly; choose an IANA timezone string such as `Europe/Helsinki` or `America/New_York`. If you leave it blank in the app, Thesis Journey Tracker defaults to `Europe/Helsinki`.
   Thesis Journey Tracker stores meeting timestamps in UTC, then uses this configured timezone when rendering dashboard timestamps and when converting `datetime-local` form values back to UTC.

### Optional: Save Google Credentials Inside The App

Store the Google Calendar values from the app like this:

1. Make sure strong, independent `SESSION_SECRET` and `APP_ENCRYPTION_SECRET` values are set
2. Start the app and sign in as an editor
3. Open `/data-tools`
4. Paste the Google client ID, client secret, refresh token, calendar ID, and optional timezone into the `Google Calendar Credentials` form
5. Save the form

Those values are encrypted before they are written to the `app_secrets` table in D1.
Stored client secrets and refresh tokens are write-only in the Data Tools page: the Worker never places their decrypted values back into HTML. Leave a secret field blank when editing the non-secret settings to preserve its current value, or use the removal controls to clear it explicitly.

### Simpler Fallback: Google Calendar iCal Link

If you only want read-only calendar availability and do not need the app to create invitations, you can use the easier iCal fallback mode instead of the full OAuth setup.

Google documents this path here:
- [Sync your calendar with computer programs](https://support.google.com/calendar/answer/37648?hl=en)

What to do:
1. Open Google Calendar on the web
2. Go to `Settings and sharing` for the calendar you want to use
3. Open `Integrate calendar`
4. Copy the `Secret address in iCal format`
5. Save that link into the `Google Calendar iCal URL` field in `Data Tools`
6. Optionally save a timezone such as `Europe/Helsinki`

Important limitations:
- This mode is read-only. It shows existing calendar events and open slots, but it does not create events or send invitations from the app.
- Google treats the `Secret address in iCal format` as sensitive. Do not share it. If it is leaked, reset it in Google Calendar.
- Stored iCal addresses are write-only in Data Tools. Leave the field blank to preserve the current address, or use the removal control to clear it.
- The app accepts only the exact HTTPS secret-feed format served by `calendar.google.com`; redirects are checked against the same allowlist.
- Each download has a 10-second timeout and a 5 MiB response limit. Oversized, malformed, or excessively complex calendars are rejected instead of being partially imported.
- On some work or school Google accounts, the secret iCal address may be unavailable if the admin has disabled it.

## 4. Apply Migrations

```bash
npm run db:migrate
```

This applies the SQL files in [`migrations/`](../migrations) to Wrangler's local D1 state for the configured `thesis_tracker_db` binding.

## 5. Create At Least One Login Account

Create an editor account in D1:

```bash
npm run account:create -- --name "Advisor" --role editor
```

Optional readonly account:

```bash
npm run account:create -- --name "Professor" --role readonly
```

The command prompts twice without echoing the password. Passwords must contain at least 15 characters. For non-interactive automation, pass `--password-stdin` and supply exactly one line from a secret manager; never place the password in command arguments.

If an existing account uses any work factor other than the current Cloudflare-compatible `100000` iteration format, re-run `npm run account:create` for that account. Updating an account also revokes its existing sessions.

## 6. Optionally Load Sample Data

If you want a ready-made local dataset for trying the dashboard, import/export, and reports:

```bash
npm run db:seed:sample
```

This command only targets Wrangler's local D1 state and is safe to re-run because the sample inserts are idempotent.

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

Run the setup doctor:

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
