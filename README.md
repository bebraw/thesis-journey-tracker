# Thesis Journey Tracker

Thesis Journey Tracker is a private advising dashboard for following students as they move through a thesis process. It is built for small supervision teams: you can keep track of thesis phases, upcoming meetings, thesis topics, and supervision notes in one place, with editor or readonly access per account.

The project is intentionally small and server-rendered, with a focused workflow for thesis advising instead of a generic student information system.

## Screenshots

<table>
  <tr>
    <td width="70%">
      <img src="./docs/screenshots/dashboard-overview.png" alt="Dashboard overview with filters plus list, phase, and Gantt views." />
    </td>
    <td width="30%">
      <img src="./docs/screenshots/student-panel.png" alt="Selected student area with editing controls, meeting log history, and phase audit." />
    </td>
  </tr>
  <tr>
    <td>
      <strong>Dashboard overview</strong><br />
      Switch between list, phase, and Gantt views, scan upcoming supervision work, and keep the selected student workspace open while browsing the cohort.
    </td>
    <td>
      <strong>Student workspace</strong><br />
      Review the current student state, add supervision notes, and inspect phase history without leaving the dashboard.
    </td>
  </tr>
</table>

## Why This Project Exists

- Keep thesis supervision work organized without relying on spreadsheets or scattered notes.
- See where students are in the process at a glance.
- Record meeting outcomes and next steps in a format that is easy to revisit later.

## What You Can Do With It

- Add students with degree type, thesis topic, and timeline information.
- Track each student through thesis phases from planning to submission.
- Configure the dashboard lane labels at the app level while keeping the original four-phase board structure as the default.
- Switch between `List`, `Phases`, and `Gantt` views depending on whether you need detail, workflow stage, or workload shape.
- Store supervision logs with discussion notes, action items, and an optional follow-up meeting time in one save.
- Follow upcoming meetings from the dashboard, and clear a cancelled meeting until a new time is booked.
- Use quick stats on the dashboard to jump straight into filtered student views that need attention.
- Use the Gantt view to estimate advisor workload visually from student start dates and degree-based thesis duration assumptions.
- Archive completed or inactive students without deleting their supervision history.
- Open a weekly Google Calendar scheduling view, choose a student to update the week immediately, and send meeting invites to students. If you want a lower-friction setup, the app also supports a read-only Google Calendar iCal fallback for availability.
- Export or restore the dataset as JSON backups, and download an email-ready Markdown status report.
- Store automated Cloudflare backups in R2 when deployed with the scheduled backup setup.

## Quick Start

1. Install dependencies and generate Worker types:

```bash
npm install
npm run types:generate
```

2. Create your local environment file:

```bash
cp .dev.vars.example .dev.vars
```

Set `SESSION_SECRET` before starting the app.

3. Apply migrations and create your first account:

```bash
npm run db:migrate
npm run account:create -- --name "Advisor" --password "change-this-password" --role editor
```

Optional: load sample data for a ready-made local dashboard:

```bash
npm run db:seed:sample
```

4. Start the app:

```bash
npm run dev
```

Wrangler will print the local URL, typically `http://127.0.0.1:8787`.

For the full setup flow, Google Calendar configuration, remote account management, and troubleshooting, see [docs/setup.md](./docs/setup.md).

## Documentation

- [docs/setup.md](./docs/setup.md): local setup, environment variables, Google Calendar configuration, and first run
- [docs/development.md](./docs/development.md): scripts, testing, local CI, and day-to-day engineering workflows
- [docs/deployment.md](./docs/deployment.md): production deployment, security, and release notes
- [docs/project-structure.md](./docs/project-structure.md): architecture, directory map, and codebase orientation
- [docs/backups.md](./docs/backups.md): automated R2 backups and restore flow
- [docs/performance-plan.md](./docs/performance-plan.md): Lighthouse baseline and performance follow-up
- [docs/passkey-auth-plan.md](./docs/passkey-auth-plan.md): deferred passkey assessment and rollout plan
- [docs/roadmap.md](./docs/roadmap.md): future feature ideas and next steps
- [AGENTS.md](./AGENTS.md): durable repo-specific rules for automated contributors

If you want to understand how the codebase is organized before diving in, start with [docs/project-structure.md](./docs/project-structure.md).
