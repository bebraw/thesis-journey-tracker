# Template Maintenance

The maintenance source is [bebraw/vibe-template](https://github.com/bebraw/vibe-template), recorded in `package.json` under `vibeTemplate`. The current source baseline is `4428c4351b98769c4ba839d55bc32672ffe02c8b`, verified against remote `main` on 2026-10-02.

## Applied Updates

| Update ID                                 | Adaptation                                                                                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-07-08-typescript-7-typecheck`       | TypeScript 7 checks the project; TypeScript 6 remains available under the canonical package name for compiler API consumers.                                                                  |
| `2026-07-13-agent-ci-progress-events`     | Local CI run commands emit NDJSON progress and pause failed runners for retry.                                                                                                                |
| `2026-08-17-dependency-toolchain-refresh` | Agent CI becomes `run-local-ci`, with canonical environment names and refreshed existing tooling. This app has no mutation or Fallow setup to migrate.                                        |
| `2026-10-02-scope-agent-guidance`         | Task-relevant context reading, persistent user authorization, and focused verification guidance merge into the existing project rules. No specification or Project Start workflow is adopted. |

The selected patches failed `git apply --check` against this app's paths and custom workflow. Their relevant behavior was ported manually, preserving the full dependency audit, strict lifecycle-script allowlist, immutable local runner seed, D1 checks, browser tests, and authenticated mobile/desktop Lighthouse budgets.

Before this sync, Node 24/npm 11, install-step prewarming, and isolated Agent CI job caches were already present. This is inferred from the package pins, CI workflow, and local runner wrapper; there was no previous update record. Earlier version matrices are superseded by the current pins.

## Partial Dependency Refresh

`2026-10-02-dependency-refresh` is recorded under `vibeTemplate.partialUpdates`: Node 24.21.0, npm 11.21.0, and the existing development tools use the current template pins, while Playwright remains at the preceding template baseline, `1.62.1`, with its matching digest-pinned CI image. The remaining gap is adopting Playwright `1.63.0` once its bundled Chromium passes the full audit on Linux ARM64.

On this macOS ARM64 machine's Local CI container, Playwright 1.63.0's Chromium 153.0.8010.12 crashes its GPU process when trace screenshots are enabled. Ordinary browser tests pass, but Lighthouse loses its Chrome session. The same failure reproduces on a public page without the application or Lighthouse. Removing the screenshot trace category lets the reproduction finish; that is diagnostic evidence, not an acceptable audit workaround because the full performance gate needs those screenshots. The prior Playwright 1.62.1 browser, Chromium 151.0.7922.34, completes a full Lighthouse 13.5.0 public-page audit with a performance score of 100.

Run this with Playwright 1.63.0 in its Linux ARM64 image to reproduce the upstream gap:

```js
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const session = await page.context().newCDPSession(page);
  await session.send("Tracing.start", {
    categories: "devtools.timeline,v8.execute,disabled-by-default-devtools.screenshot",
    transferMode: "ReturnAsStream",
  });
  await page.goto("https://example.com");
  await page.waitForTimeout(5_000);
  await session.send("Tracing.end");
} finally {
  await browser.close();
}
```

The boilerplate shares the affected versions and launcher setup. Its follow-up should verify trace screenshots and the full Lighthouse gate on Linux ARM64 before distributing that browser refresh; the reproduction above provides a focused regression check.

## Skipped Updates

- Optional capability kits, mutation testing, Fallow diagnostics, lint/coverage gates, affected-file hooks, architecture scaffolding, and additional agent skills are not adopted by this app.
- Room State, Workers AI, browser static-assets composition, capability verification, and their follow-up fixes apply to capabilities absent here.
- Deployment Safety is optional; the app retains its documented automatic production promotion and direct deploy fallback.
- Project Start, To Spec, Wayfinder, Modern Web Guidance, and the skill validator apply to agent workflows not installed here. The app's own frontend skill remains authoritative.
- Prettier cache/ownership updates and path-aware expensive CI would add workflow behavior beyond the existing setup; they are deferred. The current full containerized gate remains the readiness baseline.
- Starter response/style changes and Worker operational packs depend on template-specific runtime or capability code. This sync preserves the app's existing routes, security policy, and observability.

## Future Syncs

Start with the source repository's `.template/updates/AGENT_SYNC.md`, compare new packs with the recorded baseline and applied IDs, and port only relevant maintenance. Regenerate this project's lockfile, review lifecycle scripts before permitting them, keep runtime and browser images aligned, and run the fast gate, Docker build, and full local CI workflow for toolchain changes.
