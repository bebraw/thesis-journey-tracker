# Deployment

This guide covers CI, production deployment, automated backups, and the current security model.

## Continuous Integration

GitHub Actions runs the workflow in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) on pushes to `main` and on pull requests. The same workflow can also be run locally with `npm run ci:local` or `npm run ci:local:quiet`.

The workflow keeps Node.js `24.18.0` LTS aligned with [`.nvmrc`](../.nvmrc) so local `nvm use` and CI stay aligned.

The workflow runs:

- `npm ci`
- `npm run quality:gate:fast`
- `npm run e2e && npm run lighthouse`

The fast gate refreshes [`worker-configuration.d.ts`](../worker-configuration.d.ts) before the rest of its checks so the checked-in Worker types stay aligned with the current Wrangler configuration.

The fast job runs inside a digest-pinned `node:24.18.0-bookworm` image, and the browser job runs inside `mcr.microsoft.com/playwright:v1.58.2-noble`. That keeps the local Agent CI runner off the host's Node runtime while still matching the repo's pinned Node and Playwright versions.

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

## Automated Backups

The Worker includes a scheduled backup job that writes an app JSON export, a professor-ready Markdown report, and a backup manifest into an R2 bucket whenever the exported student data changed since the latest stored backup.

To enable it:

1. Create an R2 bucket:

```bash
npx wrangler r2 bucket create thesis-journey-tracker-backups
```

2. Update [`wrangler.toml`](../wrangler.toml) so `bucket_name` points at that bucket.

3. Review the configured cron trigger:

```toml
[triggers]
crons = ["30 1 * * *"]
```

That default means the backup runs daily at `01:30 UTC`.

4. Deploy the Worker after the R2 binding is configured:

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
- `npm run db:insights` is useful after deployment for checking whether the dashboard queries stay within expected D1 read and latency budgets.

## Security Model

- App access is protected by signed session cookies and lightweight account roles.
- Five failures lock the targeted account for 15 minutes, even when they come from different clients. Twenty failures from one trusted Cloudflare client address also trigger a 15-minute client lockout. Direct/local traffic shares one client bucket, forwarded headers are ignored outside the Cloudflare request boundary, and stored client keys are HMAC-obscured rather than raw IP addresses.
- `editor` accounts can add, edit, import, export, and archive student data.
- `readonly` accounts can view the dashboard, student details, meeting logs, and phase history.
- Sessions are stored in an `HttpOnly`, `Secure`, signed cookie.
- Signed sessions expire after four hours and carry only an immutable account ID plus a database session version. Logout, password changes, role changes through the account command, and account removal invalidate previously issued access; logout revokes every active session for that account.
- The current model is suitable for private personal or small-team use.
- If stronger access control is needed later, Cloudflare Access or another SSO layer would be a natural next step.
