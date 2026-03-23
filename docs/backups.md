# Backups

This project can create automated backups when it is deployed on Cloudflare with both D1 and R2 configured.

## What The Scheduled Backup Stores

Each scheduled run writes three files into the configured R2 bucket:

- a full JSON app export that can be restored from the Data Tools page
- a professor-friendly Markdown status report
- a small manifest file with counts, the cron expression, and the generated object keys

By default the files are stored under:

```text
automated-backups/YYYY/MM/DD/TIMESTAMP/
```

## Cloudflare Configuration

1. Create an R2 bucket:

```bash
npx wrangler r2 bucket create thesis-journey-tracker-backups
```

2. Update [`wrangler.toml`](../wrangler.toml):

```toml
[triggers]
crons = ["30 1 * * *"]

[[r2_buckets]]
binding = "BACKUP_BUCKET"
bucket_name = "thesis-journey-tracker-backups"

[vars]
BACKUP_PREFIX = "automated-backups"
```

The default cron runs every day at `01:30 UTC`. Adjust it if another off-peak window fits your usage better.

## Testing The Backup Locally

Wrangler can expose scheduled handlers in local development:

```bash
npx wrangler dev --test-scheduled
```

Then trigger the cron route from another terminal:

```bash
curl "http://127.0.0.1:8787/__scheduled?cron=30+1+*+*+*"
```

If the `BACKUP_BUCKET` binding is configured, the run will write the backup artifacts into Wrangler's local R2 state.

## Restoring From Backup

For app-level restore, download the JSON export from R2 and import it from the Data Tools page in the deployed app. Use append mode for merging data or replacement mode for a full restore.

## Retention

R2 retention is not managed by the Worker itself. A good default is:

- keep daily backups for 90 days
- keep a smaller weekly or monthly archive longer if needed
- test a restore regularly instead of only checking that files exist

Cloudflare R2 lifecycle rules are a good fit for automatic cleanup once you decide on a retention window.
