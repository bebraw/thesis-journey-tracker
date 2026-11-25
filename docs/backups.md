# Backups

This project can create automated backups when it is deployed on Cloudflare with both D1 and R2 configured.

## What The Scheduled Backup Stores

Each scheduled run compares the latest stored backup against a stable hash of the current JSON export content. When the exported student data has changed, or the latest valid snapshot is at least 30 days old, the Worker writes three files into the configured R2 bucket:

- a version 3 JSON export of active and archived students, supervisor and advisor assignments, and the source installation ID
- a professor-friendly Markdown status report
- a small manifest file with counts, the cron expression, and the generated object keys

If the exported data is unchanged and the latest valid snapshot is younger than 30 days, the scheduled run skips creating a duplicate. Missing, invalid, or future-dated manifest timestamps are not trusted; the Worker writes a fresh snapshot instead.

By default the files are stored under:

```text
automated-backups/YYYY/MM/DD/TIMESTAMP/
```

## Cloudflare Configuration

1. Create an R2 bucket:

```bash
npx wrangler r2 bucket create thesis-journey-tracker-backup
```

2. Add a 90-day lifecycle rule for the default backup prefix, then verify it:

```bash
npx wrangler r2 bucket lifecycle add thesis-journey-tracker-backup expire-automated-backups automated-backups/ --expire-days 90
npx wrangler r2 bucket lifecycle list thesis-journey-tracker-backup
```

Backup setup is incomplete until the listing shows the `expire-automated-backups` rule for the `automated-backups/` prefix with a 90-day expiration. The Worker does not delete backups itself. All three files in a snapshot use this prefix, so the rule expires the JSON export, Markdown report, and manifest together.

3. Confirm that [`wrangler.toml`](../wrangler.toml) uses the same bucket and prefix:

```toml
[triggers]
crons = ["30 1 * * *"]

[[r2_buckets]]
binding = "BACKUP_BUCKET"
bucket_name = "thesis-journey-tracker-backup"

[vars]
BACKUP_PREFIX = "automated-backups"
```

The default cron runs every day at `01:30 UTC`. Adjust it if another off-peak window fits your usage better.

Keep the bucket private. The JSON export and Markdown report contain student data and should not be exposed through a public bucket URL or custom domain.

The Markdown report includes student names, topics, and the latest agreed plans as escaped, single-line content; internal student notes and discussion text remain excluded. Imported content cannot add report headings, links, remote images, or raw HTML when the report is opened in a Markdown viewer.

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

Account records, password hashes, agent tokens, and global settings are outside the student JSON format. Use a protected full D1 export and a tested database restore point for schema upgrades. [Cohort upgrade procedure](./deployment.md#upgrading-an-existing-cohort)

For app-level restore, sign in as an administrator, download the JSON export from R2, and import it from the Data Tools page. Append creates new student records. Replacement rebuilds the entire student dataset with fresh student IDs. After a replacement, reopen theses from the dashboard or Manage access. Old direct links and already-open team forms refer to the previous records. The importer accepts files up to 4 MiB and restores each file in one database transaction. Split oversized append imports into smaller files.

Version 3 identifies the source installation. When restoring to the original database or a full D1 recovery copy, the importer checks each team member’s immutable account ID and original backup name. Renaming an existing account preserves this pair. A replacement login gets its own ID.

When importing a version 3 file from another installation, **Match backup accounts** asks you to select a local person for each member of the source team. Verify each person even when the account names or numbers match. Select the same file again and confirm the import. Version 2 backups also use this step because they lack an installation ID. Version 1 backups have no assignments, so select a supervisor on the initial import form.

## Retention

R2 retention is not managed by the Worker itself. The lifecycle rule above applies the project's 90-day default to every object under `automated-backups/`. The Worker refreshes unchanged data every 30 days so normal daily cron operation keeps recent restore points inside that retention window instead of allowing the only unchanged snapshot to age out.

To change the retention window or `BACKUP_PREFIX`, remove the named rule and re-add it with the desired day count and matching prefix. These commands restore the checked-in default:

```bash
npx wrangler r2 bucket lifecycle remove thesis-journey-tracker-backup --name expire-automated-backups
npx wrangler r2 bucket lifecycle add thesis-journey-tracker-backup expire-automated-backups automated-backups/ --expire-days 90
npx wrangler r2 bucket lifecycle list thesis-journey-tracker-backup
```

The current automation does not create a separate weekly or monthly archive. If longer retention is required, copy selected snapshots into a distinct private prefix or bucket and give that location its own lifecycle policy.

Test a restore regularly instead of only checking that files exist. Confirm that the JSON import succeeds, the restored record counts match the manifest, and the Markdown report opens as expected.
