# Deployment

This guide covers CI, production deployment, automated backups, and the current security model.

## Continuous Integration

GitHub Actions runs the workflow in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) on every push and pull request.

The workflow runs:

- `npm ci`
- `npx playwright install --with-deps chromium`
- `npm run typecheck`
- `npm test`
- `npm run e2e`
- `npm run lighthouse`

## Deploying To Cloudflare

1. Authenticate Wrangler:

```bash
npx wrangler login
```

2. Set production secrets:

```bash
npx wrangler secret put APP_USERS_JSON
npx wrangler secret put SESSION_SECRET
```

`APP_USERS_JSON` should contain a JSON array such as:

```json
[{"name":"Advisor","password":"editor-password","role":"editor"},{"name":"Professor","password":"readonly-password","role":"readonly"}]
```

If you are keeping an older single-user deployment, `APP_PASSWORD` remains supported as a fallback editor login.

3. Apply remote migrations:

```bash
npm run db:migrate:remote
```

4. Deploy:

```bash
npm run deploy
```

## Automated Backups

The Worker includes a scheduled backup job that writes an app JSON export, a professor-ready Markdown report, and a backup manifest into an R2 bucket.

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
- The CSS build runs automatically before deploy through Wrangler's build configuration.
- If you are upgrading an existing instance, make sure the latest migrations have been applied before or during deployment.
- Automated backups are stored under the `BACKUP_PREFIX` path in the configured R2 bucket.

## Security Model

- App access is protected by signed session cookies and lightweight account roles.
- `editor` accounts can add, edit, import, export, and delete data.
- `readonly` accounts can view the dashboard, student details, meeting logs, and phase history.
- Sessions are stored in an `HttpOnly`, `Secure`, signed cookie.
- The current model is suitable for private personal or small-team use.
- If stronger access control is needed later, Cloudflare Access or another SSO layer would be a natural next step.
