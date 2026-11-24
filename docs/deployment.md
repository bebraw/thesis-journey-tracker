# Deployment

This guide covers CI, production deployment, automated backups, and the current security model.

## Continuous Integration

GitHub Actions runs the workflow in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) on pushes to `main` and on pull requests. The same workflow can also be run locally with `npm run ci:local` or `npm run ci:local:quiet`.

GitHub Actions validates the repository but does not publish Worker versions. The connected Cloudflare Git build runs independently: its `main` production trigger uses `npx wrangler deploy`, while non-production branches use `npx wrangler versions upload`. A successful Cloudflare build from `main` therefore promotes the new version to production automatically. Because Cloudflare Builds is not gated on GitHub Actions, treat every push to `main` as a production release and complete the relevant checks before pushing.

The workflow keeps Node.js `24.21.0` LTS aligned with [`.nvmrc`](../.nvmrc) so local `nvm use` and CI stay aligned.

The workflow runs:

- `npm ci --strict-allow-scripts`
- `npm run quality:gate:fast`
- `npm run e2e && npm run lighthouse`

The fast gate fails on npm advisories, then verifies [`worker-configuration.d.ts`](../worker-configuration.d.ts) before the rest of its checks, so CI also rejects checked-in Worker types that drift from the Wrangler configuration instead of silently rewriting them.

The jobs target the explicit Ubuntu 24.04 runner line. The fast job runs inside a digest-pinned `node:24.21.0-bookworm` image, the browser job runs inside a digest-pinned `mcr.microsoft.com/playwright:v1.62.1-noble` image, and third-party Actions are pinned to reviewed commit SHAs. Checkout does not persist its GitHub credential because later steps do not need authenticated Git access. The Local CI wrapper also pins and verifies its otherwise mutable upstream runner seed, and cache paths include both the reviewed Local CI version and image digest. These controls keep the local jobs off the host's Node runtime while matching the repo's pinned Node and Playwright versions and preventing mutable tags from changing executable CI dependencies unexpectedly.

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

Generate two independent values with `openssl rand -base64 32`; never reuse one value for both bindings. Both secrets are required; the application key encrypts custom dashboard lane settings.

[`wrangler.toml`](../wrangler.toml) declares both bindings as required. Wrangler refuses to deploy when either production secret is missing, while the Worker still validates their strength and independence at runtime.

If an existing deployment previously omitted `APP_ENCRYPTION_SECRET`, its stored custom-lane settings were encrypted with the old session-key fallback. Record the configuration before upgrading, deploy with a new independent application key, clear the unreadable stored settings, and re-enter them.

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

Migration `0006_remove_google_calendar_settings.sql` removes the retired Google Calendar credentials and iCal URL from D1. It preserves custom lane settings, student records, and internal meeting schedules.

4. Create at least one remote login account in D1:

```bash
npm run account:create -- --name "Advisor" --role editor --remote
```

For a new installation, follow [first-administrator setup](./setup.md#5-create-the-first-administrator) with `--remote` targeting your intended production database. For a running tracker, follow the upgrade procedure below before promoting the Worker.

The command reads a password of at least 15 characters from a hidden interactive prompt. For automation, use `--password-stdin` with a secret-manager source. Plaintext password arguments, custom iteration counts, and SQL printing are intentionally unsupported. Re-run the command for any account whose stored hash uses a work factor other than the current Cloudflare-compatible `100000` format; updating an account revokes its existing sessions.

The `100000` PBKDF2 work factor is the current Workers runtime compatibility ceiling used by this project. Together with the app's session controls and login throttling, it is accepted for private personal or small-team use. Application throttling is not an edge denial-of-service boundary: sufficiently distributed traffic can still consume D1 reads and PBKDF2 work. If the app is exposed more broadly or shows abuse or unexpected cost, add Cloudflare Access, Turnstile, or an appropriate WAF or rate-limit rule.

5. Deploy a reviewed version.

For the normal Git-connected release path, push the reviewed commit to `main`. The connected Cloudflare build runs `npx wrangler deploy`, which uploads the version and promotes it to 100% of production traffic after that build succeeds. Monitor both GitHub Actions and the Cloudflare build because they run independently; a Cloudflare deployment can complete before GitHub Actions finishes.

Keep the Worker settings under **Settings → Build** aligned with this workflow: the production branch is `main`, its deploy command is `npx wrangler deploy`, and the non-production branch deploy command remains `npx wrangler versions upload`.

If the connected build is unavailable, `npm run deploy` is the direct fallback and likewise uploads and immediately promotes a version. Run the same release checks first. To stage a version without promoting it, use `npx wrangler versions upload`; that is an intentional manual-release flow rather than the default `main` behavior.

[`wrangler.toml`](../wrangler.toml) explicitly disables public [versioned and aliased Preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/). A deploy reconciles that setting; for an existing Worker, disable Preview URLs in the Cloudflare dashboard immediately if you cannot deploy yet.

6. For a custom domain, enable Cloudflare's [Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/) option. The Worker also redirects non-local HTTP as defense in depth, but an application redirect cannot protect request bytes that a client already sent over its first plaintext connection.

This repository leaves the stable [`workers.dev` route](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) enabled because it cannot know your production hostname. Once a custom domain or route is configured and verified, add `workers_dev = false` to `wrangler.toml`. If `workers.dev` must remain available, protect that hostname with Cloudflare Access too; an Access policy on only the custom hostname does not cover the separate `workers.dev` endpoint.

## Upgrading an existing cohort

Migration `0007` adds account flags and a thesis assignment table. Migration `0008` promotes a legacy installation’s sole editor to administrator and supervisor. The editor keeps the same account ID and password and signs in again. If the team consists of one editor and one read-only account, the editor becomes lead on every existing thesis and the reader becomes an advisor on each. This covers archived theses, notes and phase history. The reader keeps read-only rights. New theses start with their creating supervisor, who adds advisors individually.

With a different mix of accounts, an administrator assigns existing theses in **Manage access**. With zero or multiple editors, choose the first administrator using the [verified-ID setup](./setup.md#5-create-the-first-administrator). Migration `0008` skips installations with any administrator, supervisor, disabled account, or thesis assignment. If a rehearsal database already ran an earlier draft of `0008`, use a fresh copy of the pre-upgrade backup to test the final migration.

Migration `0009` preserves the name used in thesis backups when a user changes their sign-in name. Apply it before deploying the Worker with self-service username changes. [Restoring from backup](./backups.md#restoring-from-backup)

1. Rehearse on a private database. Export the full D1 schema and data, store it securely, and restore it into the rehearsal database. Compare the original and restored records by ID and content, including notes, recurring meetings, phase history, archived students, settings, and user and token records. The app JSON backup is a separate recovery format. [D1 database export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
2. Apply the migrations on the rehearsal copy. Check both account IDs and roles and the intended administrator’s `is_admin` and `can_supervise` flags. For the two-person legacy team, verify that each account has one assignment per pre-upgrade student ID, archived IDs included. Use the verified-ID setup if the installation still needs its first administrator.
3. Before merging to `main`, arrange a short maintenance window covering browser and MCP writes, take a fresh full database recovery point and record its D1 Time Travel bookmark. Apply the remote migrations, verify the administrator as rehearsed, and deploy the reviewed Worker. Cloudflare promotes pushes to `main` independently of GitHub CI. Restrict access to the operator during reconciliation. [D1 recovery bookmarks](https://developers.cloudflare.com/d1/reference/time-travel/)
4. In **Manage access**, confirm the migrated thesis teams and assign any unmapped theses. Compare the student, meeting and phase-history records against the recovery copy. Check dashboard counts, direct student links and MCP for both accounts, and the cohort report for the supervisor. Open access to advisors after these checks pass.
5. If a thesis is missing from a dashboard, inspect and correct its assignment. A pre-upgrade Worker gives all signed-in users cohort-wide visibility. Keep traffic restricted if a rollback is required. After writes resume, preserve subsequent notes and reconcile them before any database rewind.

## Automated Backups

The Worker includes a scheduled backup job that writes an app JSON export, a professor-ready Markdown report, and a backup manifest into an R2 bucket whenever the exported student data changed since the latest stored backup. Unchanged data is refreshed every 30 days so the 90-day lifecycle retains recent restore points; missing, invalid, or future-dated manifest timestamps force a fresh snapshot.

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

6. After the R2 binding and lifecycle rule are configured, deploy a reviewed Worker version using step 5 under [Deploying To Cloudflare](#deploying-to-cloudflare).

For more detailed backup notes, see [backups.md](./backups.md).

## Production Notes

- The Worker configuration lives in [`wrangler.toml`](../wrangler.toml).
- Refresh [`worker-configuration.d.ts`](../worker-configuration.d.ts) with `npm run types:generate` whenever the Worker bindings change.
- The CSS build runs automatically before deploy through Wrangler's build configuration.
- Successful connected Git builds from `main` automatically promote their version to production. GitHub Actions runs independently and does not gate that promotion.
- If you are upgrading an existing instance, make sure the latest migrations have been applied before or during deployment.
- Automated backups are stored under the `BACKUP_PREFIX` path in the configured R2 bucket.
- Automatic Worker traces are disabled; application failures use structured logs.
- Application failures are logged as structured `application_error` objects with stable event names and normalized error fields. Request bodies, cookies, query strings, and credentials must not be added as log context.
- Unhandled production errors return a generic message plus an `X-Incident-ID` response header. Ask users to include the displayed reference when reporting a failure, then filter Workers Logs by `incident_id`.
- Public versioned and aliased Preview URLs are disabled. The stable `workers.dev` endpoint remains a separate production entry point until a custom route is configured and `workers_dev = false` is committed.
- `npm run db:insights` is useful after deployment for checking whether the dashboard queries stay within expected D1 read and latency budgets.

## Security Model

- App access is protected by signed session cookies and lightweight account roles.
- Invalid logins update two HMAC-opaque throttling buckets: one for the attempted account name and one for the trusted Cloudflare client address. The fifth account failure or twentieth client failure rate-limits further invalid attempts for 15 minutes, while correct credentials are still verified and accepted so an attacker cannot lock out the account. A successful login clears its account bucket but preserves an active client throttle. Direct/local traffic shares one client bucket, and forwarded headers are ignored outside the Cloudflare request boundary.
- Editors can update assigned active theses. Supervisors can create theses, assign advisors, and archive or restore theses they lead.
- Read-only accounts can review the history of assigned theses. Administrators manage accounts, lead transfers, app-wide settings and full-data backups. Administrative status alone gives no personal-dashboard assignments.
- Sessions are stored in an `HttpOnly`, `Secure`, signed cookie.
- Signed sessions expire after four hours and carry only an immutable account ID plus a database session version. Logout, password changes, role changes through the account command, and account removal invalidate previously issued access; logout revokes every active session for that account.
- Request-scoped D1 sessions begin on the primary database. Authentication and session-revocation reads never trust a client-supplied D1 bookmark, so future read-replication settings cannot temporarily restore revoked access.
- Every HTTP response receives a restrictive Content Security Policy and browser hardening headers at the Worker boundary. Inline scripts and HTML event handlers are disallowed; inline style attributes remain allowed because the Gantt layout calculates positions and widths at runtime.
- Non-local HTTP requests receive a same-URL `308` redirect before origin validation, D1 access, or authentication work. Local development hosts may remain on HTTP. HTTPS responses enable HTTP Strict Transport Security for one year; redirects and local HTTP responses deliberately omit HSTS.
- Every state-changing HTTP request must carry an `Origin` header that exactly matches the request URL's origin. Browsers add this automatically for the app's forms and fetch requests; maintenance scripts must supply it explicitly.
- Downloaded and automated Markdown reports escape student-supplied text and collapse embedded line breaks so imported content cannot inject headings, links, remote images, or raw HTML.
- The current model is suitable for private personal or small-team use.
- Distributed or rotating-source login traffic can still consume D1 and password-verification work even though the in-app throttles limit ordinary brute force and prevent forced account lockout. This availability and cost exposure is an accepted residual for the current private deployment, not a known authentication bypass. Reassess Cloudflare Access, Turnstile, or edge WAF/rate limiting if exposure or traffic grows.
