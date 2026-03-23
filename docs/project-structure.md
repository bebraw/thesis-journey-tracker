# Project Structure

This document gives a technical overview of how the project is put together.

## Stack

- Cloudflare Workers for the runtime and hosting layer
- Cloudflare D1 as the SQLite-backed database
- TypeScript for application code
- HTMLisp for server-rendered HTML views
- Tailwind CSS for styling
- Playwright and Vitest for testing

## Architecture At A Glance

- [`src/worker.ts`](../src/worker.ts): route handling, auth, rendering, and core app logic
- [`src/reference-data.ts`](../src/reference-data.ts): shared thesis phase and degree reference data
- [`src/view/`](../src/view): page and partial rendering helpers
- [`src/view/dashboard/`](../src/view/dashboard): dashboard-specific sections and interactions
- [`src/view/data-tools.htmlisp.ts`](../src/view/data-tools.htmlisp.ts): backup import/export page
- [`src/ui/`](../src/ui): reusable UI components and styling helpers
- [`src/db.ts`](../src/db.ts): database access helpers
- [`migrations/`](../migrations): schema changes for D1
- [`tests/`](../tests): end-to-end and security-oriented automated tests

## Architecture Diagram

```mermaid
graph TD
    Browser[Browser]
    Worker[src/worker.ts<br/>Routes, auth, page rendering]
    Views[src/view/<br/>Page templates]
    Dashboard[src/view/dashboard/<br/>Dashboard sections and interactions]
    UI[src/ui/<br/>Reusable UI components]
    Reference[src/reference-data.ts<br/>Phases and degree types]
    DB[src/db.ts<br/>Database helpers]
    D1[(Cloudflare D1)]
    Migrations[migrations/<br/>Schema changes]
    Tests[tests/<br/>Vitest and Playwright]
    CSS[src/tailwind-input.css + .generated/styles.css]

    Browser --> Worker
    Worker --> Views
    Worker --> Dashboard
    Worker --> UI
    Worker --> Reference
    Worker --> DB
    Worker --> CSS
    DB --> D1
    Migrations --> D1
    Tests --> Worker
    Tests --> D1
```

The Worker is the center of the app: it handles requests, checks authentication, talks to D1 through the database helpers, and renders server-side HTML using the shared view and UI layers.

## Repository Map

- [`README.md`](../README.md): first-stop overview for new readers
- [`docs/`](./README.md): technical documentation
- [`editor-support/vscode-htmlisp/`](../editor-support/vscode-htmlisp): local VS Code extension for HTMLisp syntax support
- [`scripts/run-lighthouse.mjs`](../scripts/run-lighthouse.mjs): Lighthouse automation
- [`playwright.config.ts`](../playwright.config.ts): end-to-end test configuration
- [`vitest.config.ts`](../vitest.config.ts): unit and integration test configuration
- [`tailwind.config.cjs`](../tailwind.config.cjs): Tailwind scanning and theme setup

## Data And Environment Notes

- Local secrets are kept in `.dev.vars`.
- Test-only seeded data lives in [`tests/e2e/mock-data.sql`](../tests/e2e/mock-data.sql).
- Seeded mock students are isolated to the E2E environment and are not part of the normal local app data.
