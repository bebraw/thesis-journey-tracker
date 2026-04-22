# Development

This guide collects the commands and workflows you are likely to need while working on the project.

## Core Scripts

- `npm run dev`: start the app locally with Wrangler
- `npm run build:css`: rebuild the generated Tailwind stylesheet manually
- `npm run ci:local`: run the checked-in GitHub Actions workflow locally through Agent CI
- `npm run ci:local:quiet`: run the same workflow with quieter logs
- `npm run ci:local:all`: run every workflow Agent CI detects in the repo
- `npm run ci:local:retry -- --name <runner-name>`: resume a paused local Agent CI runner after fixing an issue
- `npm run types:generate`: regenerate the checked-in Worker runtime and binding types
- `npm run types:check`: verify that [`worker-configuration.d.ts`](../worker-configuration.d.ts) is up to date
- `npm run typecheck`: run TypeScript without emitting files
- `npm run db:insights`: inspect the slowest remote D1 queries over the last day
- `npm run db:seed:sample`: populate the local D1 database with reusable sample students, logs, and phase history
- `npm test`: run the Vitest suite
- `npm run test:d1`: run the D1-backed integration tests against Wrangler's local platform proxy
- `npm run quality:gate:fast`: refresh Worker types, then run TypeScript, unit tests, and D1 integration tests
- `npm run quality:gate`: run the full local verification workflow through Agent CI
- `npm run lighthouse`: run the authenticated Lighthouse performance check
- `npm run readme:screenshots`: refresh the checked-in README screenshots from the local app running on `127.0.0.1:8788`
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

## Local CI With Agent CI

Browser verification now runs through Agent CI rather than a separate local Playwright install flow.

- Start Docker before running `npm run ci:local` or `npm run ci:local:quiet`.
- If your clone has no `origin` remote, copy `.env.agent-ci.example` to `.env.agent-ci` and set `GITHUB_REPO=owner/repo`.
- If your Docker CLI uses a non-default socket or context, set `DOCKER_HOST=...` in `.env.agent-ci` so Agent CI reaches the same engine.
- If local runs complain about a missing GitHub Actions runner image, pull `ghcr.io/actions/actions-runner:latest` once and rerun the workflow.

The browser job still uses the repo's Playwright tests and config under the hood, but the supported way to run them as part of verification is the checked-in Agent CI workflow in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

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

This is a remote-only command. The current dashboard query to watch most closely is the aggregated student list in [`src/students/store.ts`](../src/students/store.ts), because it drives the main page and combines filtering, aggregation, and ordering.

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
