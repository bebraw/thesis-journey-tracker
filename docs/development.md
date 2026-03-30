# Development

This guide collects the commands and workflows you are likely to need while working on the project.

## Core Scripts

- `npm run dev`: start the app locally with Wrangler
- `npm run build:css`: rebuild the generated Tailwind stylesheet manually
- `npm run types:generate`: regenerate the checked-in Worker runtime and binding types
- `npm run types:check`: verify that [`worker-configuration.d.ts`](../worker-configuration.d.ts) is up to date
- `npm run typecheck`: run TypeScript without emitting files
- `npm run db:insights`: inspect the slowest remote D1 queries over the last day
- `npm run db:seed:sample`: populate the local D1 database with reusable sample students, logs, and phase history
- `npm test`: run the Vitest suite
- `npm run test:d1`: run the D1-backed integration tests against Wrangler's local platform proxy
- `npm run e2e`: run Playwright end-to-end tests
- `npm run lighthouse`: run the authenticated Lighthouse performance check
- `npm run deploy`: deploy the Worker

## Testing

### Unit And Integration Tests

```bash
npm test
```

This includes SQL-injection safety coverage for form actions.

If you want to exercise the database helpers against a real local D1 binding instead of the in-memory SQL mock, run:

```bash
npm run test:d1
```

This uses Wrangler's local platform proxy and applies the checked-in migrations into an isolated local D1 state for the test run.

### End-To-End Tests

Install the browser once if needed:

```bash
npx playwright install chromium
```

Then run:

```bash
npm run e2e
```

The Playwright setup starts an isolated local app instance on port `8788` and seeds test data into a separate local D1 state.

### Lighthouse Audits

```bash
npm run lighthouse
```

Reports are written to `reports/lighthouse/`. The audit enforces a minimum performance score of `90` for both mobile and desktop runs.

For current findings and follow-up work, see [performance-plan.md](./performance-plan.md).

## D1 Operations

Use Cloudflare's D1 insights command to inspect the highest-cost production queries:

```bash
npm run db:insights
```

This is a remote-only command. The current dashboard query to watch most closely is the aggregated student list in [`src/db.ts`](../src/db.ts), because it drives the main page and combines filtering, aggregation, and ordering.

## CSS And Frontend Notes

- Tailwind input lives in [`src/tailwind-input.css`](../src/tailwind-input.css).
- Generated CSS is written to `.generated/styles.css`.
- Wrangler runs the Tailwind build automatically before `dev` and `deploy`, so generated CSS does not need to be committed manually.
- The UI style guide at `/style-guide` is intentionally available only on local development hosts such as `localhost` or `127.0.0.1`.
- Project-local frontend guidance for automated contributors lives in [`.codex/skills/frontend-design/SKILL.md`](../.codex/skills/frontend-design/SKILL.md).

## Editor Support

The repo includes a VS Code extension for HTMLisp under [`editor-support/vscode-htmlisp`](../editor-support/vscode-htmlisp).

To run it locally:

1. Open `editor-support/vscode-htmlisp` in VS Code.
2. Press `F5`.
3. Use the Extension Development Host to test highlighting.

For extension-specific details, see [`editor-support/vscode-htmlisp/README.md`](../editor-support/vscode-htmlisp/README.md).

## Daily Workflow Tips

- Use [`src/worker.ts`](../src/worker.ts) as the main entry point when tracing routes or business logic.
- Shared UI pieces live in [`src/ui/`](../src/ui).
- Dashboard-specific rendering lives in [`src/view/dashboard/`](../src/view/dashboard).
- Shared student-domain code such as form parsing, thesis phases, and degree types lives in [`src/students/`](../src/students).
