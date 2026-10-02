# Development

This guide collects the commands and workflows you are likely to need while working on the project.

## Core Scripts

- `npm run dev`: start the app locally with Wrangler
- `npm run build:css`: rebuild the generated Tailwind stylesheet manually
- `npm run ci:local`: run the checked-in GitHub Actions workflow locally through Local CI
- `npm run ci:local:quiet`: run the same workflow with quieter logs
- `npm run ci:local:all`: run every workflow Local CI detects in the repo
- `npm run ci:local:retry -- --name <runner-name>`: resume a paused Local CI runner after fixing an issue
- `npm run doctor:local`: diagnose local setup issues, including `.dev.vars`, the D1 binding, migrations, and login accounts
- `npm run audit:dependencies`: fail on any npm advisory, including development-tool advisories
- `npm run types:generate`: regenerate the checked-in Worker runtime and binding types
- `npm run types:check`: verify that [`worker-configuration.d.ts`](../worker-configuration.d.ts) is up to date
- `npm run typecheck`: run TypeScript 7 without emitting files
- `npm run db:insights`: inspect the slowest remote D1 queries over the last day
- `npm run db:seed:sample`: populate the local D1 database with reusable sample students, logs, and phase history
- `npm test`: run the Vitest suite
- `npm run test:d1`: run the D1-backed integration tests against Wrangler's local platform proxy
- `npm run quality:gate:fast`: audit dependencies, verify Worker types, then run TypeScript, unit tests, and D1 integration tests
- `npm run quality:gate`: run the full local verification workflow through Local CI
- `npm run lighthouse`: run the authenticated Lighthouse performance check
- `npm run readme:screenshots`: refresh the checked-in README screenshots from the local app running on `127.0.0.1:8788`
- `npm run deploy`: directly upload and promote the Worker as a fallback when the normal `main`-branch Cloudflare build is unavailable; complete the checks in the [production release procedure](./deployment.md#deploying-to-cloudflare) first

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

## Type Checking

TypeScript 7 runs the type check; the canonical `typescript` package remains the TypeScript 6 compatibility build for tools that import its compiler API.

## Local CI

Browser verification now runs through Local CI rather than a separate local Playwright install flow.
The checked-in local-CI scripts prewarm dependencies through the fast job's `install` step before parallel jobs start, avoiding concurrent cold installs into the shared local cache.
Each parallel job receives an isolated dependency view. Run and quiet commands emit NDJSON progress and pause failed runners for `ci:local:retry`.

- Start Docker before running `npm run ci:local` or `npm run ci:local:quiet`.
- If your clone has no `origin` remote, add one or set `GITHUB_REPO=owner/repo` in the shell environment before running local CI. Local CI does not load this non-prefixed value from `.env.local-ci`.
- If your Docker CLI uses a non-default socket, set `LOCAL_CI_DOCKER_HOST=...` in `.env.local-ci` so Local CI and the wrapper reach the same engine.
- The wrapper pulls the reviewed immutable GitHub Actions runner digest when necessary, verifies the local alias resolves to that image, and partitions Local CI's runner cache by both package version and digest. Do not pull or retag `ghcr.io/actions/actions-runner:latest` manually.

Local CI replaces the former Agent CI package. Copy `.env.local-ci.example` to `.env.local-ci` for machine overrides; rename `AGENT_CI_*` keys to `LOCAL_CI_*`. Local CI still accepts the legacy `.env.agent-ci` file and variable names when no canonical value is present, and both files remain ignored.

The existing public `ci:local`, `ci:local:quiet`, `ci:local:all`, and `ci:local:retry` commands continue through [`scripts/run-local-ci.mjs`](../scripts/run-local-ci.mjs), preserving the immutable runner seed and fail-closed package-layout checks.

The browser job still uses the repo's Playwright tests and config under the hood, but the supported way to run them as part of verification is the checked-in Local CI workflow in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

### Lighthouse Audits

```bash
npm run lighthouse
```

Reports are written to `reports/lighthouse/`. The audit enforces a minimum performance score of `90` for both mobile and desktop runs.
Lighthouse is pinned to `13.5.0`. Verify both the full dependency audit and the mobile/desktop performance runs when updating it.
Playwright remains at `1.62.1` with its matching CI image while the newer bundled Chromium's Linux ARM64 trace-screenshot crash is unresolved. See [template-updates.md](./template-updates.md#partial-dependency-refresh) for the isolated reproduction and remaining template sync gap.

Dependency installation uses npm's strict lifecycle-script allowlist. Only the exact reviewed `esbuild` and `workerd` versions may run install scripts; optional accelerators, postinstall notices, and native build or binary-check fallbacks that the verified workflows do not require are explicitly denied. If an update introduces a new lifecycle script, `npm ci` fails before running it. Start a lockfile update with `npm install --ignore-scripts`, inspect the new package and script, then change `allowScripts` deliberately and rerun a clean install, the Docker build, and local CI. Do not bypass the policy to make an update pass.

For current findings and follow-up work, see [performance-plan.md](./performance-plan.md).

## D1 Operations

Use Cloudflare's D1 insights command to inspect the highest-cost production queries:

```bash
npm run db:insights
```

This is a remote-only command. The current dashboard query to watch most closely is the aggregated student list in [`src/students/store.ts`](../src/students/store.ts), because it drives the main page and combines filtering, aggregation, and ordering.

## Docker Fallback

The checked-in [`Dockerfile`](../Dockerfile) builds a development image that runs Wrangler on port `8787`. Use it when host setup is unreliable, especially on machines where Node version managers or shell differences make the normal local flow difficult.

The Docker workflow is documented in [setup.md](./setup.md#docker-backup-setup). Keep `.dev.vars` on the host and mount it read-only; do not bake local secrets into the image.

## CSS And Frontend Notes

- Tailwind input lives in [`src/tailwind-input.css`](../src/tailwind-input.css).
- Generated CSS is written to `.generated/styles.css`.
- Wrangler runs the Tailwind build automatically before `dev` and `deploy`, so generated CSS does not need to be committed manually.
- Local and deployed login screens use the same password verification path. Tests must not infer development mode from a request hostname.
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

### Meeting-note UI checks

Browser regressions cover draft retention across selection, closing, and history; failed-save recovery; successful saves retaining other drafts and the current meeting; empty results; explicit follow-up validation; and narrow-screen controls. For visual checks, use isolated sample data and review the dashboard plus `/style-guide` on desktop and mobile in both themes.

`SCREENSHOT_BASE_URL=http://127.0.0.1:8790 npm run readme:screenshots` can capture an already-running isolated sample app. The default remains the dedicated E2E server on port 8788. Captures use the real layout without hiding rows or forcing panel visibility.

Stylesheets use `Cache-Control: no-cache` so each page load revalidates the current UI. The `v=2` stylesheet query bypasses the earlier 24-hour browser cache during the utilitarian redesign rollout. JavaScript already revalidates on each load.
