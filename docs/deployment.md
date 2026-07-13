# Deployment

This guide covers CI, production deployment, automated backups, and the current security model.

## Continuous Integration

GitHub Actions runs the workflow in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) on pushes to `main` and on pull requests. The same workflow can also be run locally with `npm run ci:local` or `npm run ci:local:quiet`.

The workflow keeps Node.js `24.18.0` LTS aligned with [`.nvmrc`](../.nvmrc) so local `nvm use` and CI stay aligned.

The workflow runs:

- `npm ci --strict-allow-scripts`
- `npm run quality:gate:fast`
- `npm run e2e && npm run lighthouse`

The fast gate fails on npm advisories, then verifies [`worker-configuration.d.ts`](../worker-configuration.d.ts) before the rest of its checks, so CI also rejects checked-in Worker types that drift from the Wrangler configuration instead of silently rewriting them.

The jobs target the explicit Ubuntu 24.04 runner line. The fast job runs inside a digest-pinned `node:24.18.0-bookworm` image, the browser job runs inside a digest-pinned `mcr.microsoft.com/playwright:v1.58.2-noble` image, and third-party Actions are pinned to reviewed commit SHAs. Checkout does not persist its GitHub credential because later steps do not need authenticated Git access. The local Agent CI wrapper also pins and verifies its otherwise mutable upstream runner seed, and cache paths include both the reviewed Agent CI version and image digest. These controls keep the local jobs off the host's Node runtime while matching the repo's pinned Node and Playwright versions and preventing mutable tags from changing executable CI dependencies unexpectedly.

## Deploying To Cloudflare

1. Authenticate Wrangler:

```bash
npx wrangler login
```

2. Set production secrets:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put APP_ENCRYPTION_SECRET
```

Generate two independent values with `openssl rand -base64 32`; never reuse one value for both bindings. Both secrets are required even when Google Calendar integration is not configured.

[`wrangler.toml`](../wrangler.toml) declares both bindings as required. Wrangler refuses to deploy when either production secret is missing, while the Worker still validates their strength and independence at runtime.

If an existing deployment previously omitted `APP_ENCRYPTION_SECRET`, its stored calendar and custom-lane settings were encrypted with the old session-key fallback. Record the configuration before upgrading, deploy with a new independent application key, clear the unreadable stored settings, and re-enter them. Rotate the Google refresh token and secret iCal URL during this process.

Other plain Worker vars can still go in `wrangler.toml`:

```toml
[vars]
BACKUP_PREFIX = "automated-backups"
REPLACE_IMPORT_ENABLED = "1"
```

Leave `REPLACE_IMPORT_ENABLED` unset for the safer default where append imports remain available but full replacement restores are disabled.

3. Apply remote migrations:

```bash
npm run db:migrate:remote
```

4. Create at least one remote login account in D1:

```bash
npm run account:create -- --name "Advisor" --role editor --remote
```

Optional readonly account:

```bash
npm run account:create -- --name "Professor" --role readonly --remote
```

The command reads a password of at least 15 characters from a hidden interactive prompt. For automation, use `--password-stdin` with a secret-manager source. Plaintext password arguments, custom iteration counts, and SQL printing are intentionally unsupported. Re-run the command for any account whose stored hash uses a work factor other than the current Cloudflare-compatible `100000` format; updating an account revokes its existing sessions.

The `100000` PBKDF2 work factor is the current Workers runtime compatibility ceiling used by this project, not the long-term authentication target. Keep the app private and rate-limited, and prioritize the Cloudflare Access or passkey follow-up tracked in the roadmap.

5. Deploy:

```bash
npm run deploy
```

[`wrangler.toml`](../wrangler.toml) explicitly disables public [versioned and aliased Preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/). A deploy reconciles that setting; for an existing Worker, disable Preview URLs in the Cloudflare dashboard immediately if you cannot deploy yet.

6. For a custom domain, enable Cloudflare's [Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/) option. The Worker also redirects non-local HTTP as defense in depth, but an application redirect cannot protect request bytes that a client already sent over its first plaintext connection.

This repository leaves the stable [`workers.dev` route](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) enabled because it cannot know your production hostname. Once a custom domain or route is configured and verified, add `workers_dev = false` to `wrangler.toml`. If `workers.dev` must remain available, protect that hostname with Cloudflare Access too; an Access policy on only the custom hostname does not cover the separate `workers.dev` endpoint.

## Automated Backups

The Worker includes a scheduled backup job that writes an app JSON export, a professor-ready Markdown report, and a backup manifest into an R2 bucket whenever the exported student data changed since the latest stored backup.

To enable it:

1. Create an R2 bucket:

```bash
npx wrangler r2 bucket create thesis-journey-tracker-backup
```

2. Add the default 90-day retention rule:

```bash
npx wrangler r2 bucket lifecycle add thesis-journey-tracker-backup expire-automated-backups automated-backups/ --expire-days 90
```

3. Verify the lifecycle configuration:

```bash
npx wrangler r2 bucket lifecycle list thesis-journey-tracker-backup
```

Do not consider backup setup complete until the output shows rule `expire-automated-backups`, prefix `automated-backups/`, and a 90-day expiration. If `BACKUP_PREFIX` changes, configure and verify a lifecycle rule for the new prefix as well.

4. Confirm that [`wrangler.toml`](../wrangler.toml) points `bucket_name` at `thesis-journey-tracker-backup`. Keep this bucket private because its artifacts contain student data.

5. Review the configured cron trigger:

```toml
[triggers]
crons = ["30 1 * * *"]
```

That default means the backup runs daily at `01:30 UTC`.

6. Deploy the Worker after the R2 binding and lifecycle rule are configured:

```bash
npm run deploy
```

For more detailed backup notes, see [backups.md](./backups.md).

## Production Notes

- The Worker configuration lives in [`wrangler.toml`](../wrangler.toml).
- Refresh [`worker-configuration.d.ts`](../worker-configuration.d.ts) with `npm run types:generate` whenever the Worker bindings change.
- The CSS build runs automatically before deploy through Wrangler's build configuration.
- If you are upgrading an existing instance, make sure the latest migrations have been applied before or during deployment.
- Automated backups are stored under the `BACKUP_PREFIX` path in the configured R2 bucket.
- Automatic Worker traces are disabled because an outbound iCal request contains a bearer-style secret in its URL. Do not enable automatic fetch tracing without a design that redacts that URL before telemetry is stored.
- Public versioned and aliased Preview URLs are disabled. The stable `workers.dev` endpoint remains a separate production entry point until a custom route is configured and `workers_dev = false` is committed.
- `npm run db:insights` is useful after deployment for checking whether the dashboard queries stay within expected D1 read and latency budgets.

## Security Model

- App access is protected by signed session cookies and lightweight account roles.
- Invalid logins update two HMAC-opaque throttling buckets: one for the attempted account name and one for the trusted Cloudflare client address. The fifth account failure or twentieth client failure rate-limits further invalid attempts for 15 minutes, while correct credentials are still verified and accepted so an attacker cannot lock out the account. A successful login clears its account bucket but preserves an active client throttle. Direct/local traffic shares one client bucket, and forwarded headers are ignored outside the Cloudflare request boundary.
- `editor` accounts can add, edit, import, export, and archive student data.
- `readonly` accounts can view the dashboard, student details, meeting logs, and phase history.
- Sessions are stored in an `HttpOnly`, `Secure`, signed cookie.
- Signed sessions expire after four hours and carry only an immutable account ID plus a database session version. Logout, password changes, role changes through the account command, and account removal invalidate previously issued access; logout revokes every active session for that account.
- Request-scoped D1 sessions begin on the primary database. Authentication and session-revocation reads never trust a client-supplied D1 bookmark, so future read-replication settings cannot temporarily restore revoked access.
- Every HTTP response receives a restrictive Content Security Policy and browser hardening headers at the Worker boundary. Inline scripts and HTML event handlers are disallowed; inline style attributes remain allowed because the Gantt layout calculates positions and widths at runtime.
- Non-local HTTP requests receive a same-URL `308` redirect before origin validation, D1 access, or authentication work. Local development hosts may remain on HTTP. HTTPS responses enable HTTP Strict Transport Security for one year; redirects and local HTTP responses deliberately omit HSTS.
- Every state-changing HTTP request must carry an `Origin` header that exactly matches the request URL's origin. Browsers add this automatically for the app's forms and fetch requests; maintenance scripts must supply it explicitly.
- Google Calendar invitation defaults include only attendee-facing student and thesis-topic text. Internal student notes are excluded unless an editor deliberately writes equivalent text into the invitation description.
- Existing calendar entries are exposed to app users only as `Busy` plus their time. Google API availability reads request only event IDs and start/end values; iCal event summaries, descriptions, attendees, and links never enter the schedule view data. Prefer a dedicated shared or secondary calendar, and use a dedicated Google account when the OAuth credential must not have access to unrelated calendars.
- Downloaded and automated Markdown reports escape student-supplied text and collapse embedded line breaks so imported content cannot inject headings, links, remote images, or raw HTML.
- The current model is suitable for private personal or small-team use.
- If stronger access control is needed later, Cloudflare Access or another SSO layer would be a natural next step.
