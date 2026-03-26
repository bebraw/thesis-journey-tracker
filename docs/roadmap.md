# Roadmap Ideas

This note collects feature ideas that feel like a natural next step for the project. It is intentionally lightweight: the items here are prompts for future planning, not firm commitments.

## Current Priority Items

These are the most immediate follow-up items to address next.

### Google Calendar Scheduling View

Add a calendar view that can:

- show existing events from a Google Calendar
- schedule meetings with students directly from the app
- send a Google Calendar invitation to the student when an email address is available

This will require Google Calendar integration, calendar event sync, and a UI flow for picking a meeting slot.

### Persist Dashboard Filters In The URL

Keep student table filters in the query string so filtered views can be refreshed, bookmarked, and shared more reliably.

### Student Notes Field

Add a free-form note field for each student that:

- can be edited from the app
- is visible in the students table

### Phase Change Audit Reliability

Investigate the phase change audit feature. The database contents appear correct, so the issue may be in the rendering or retrieval path rather than the write path.

At minimum this needs better test coverage. Ideally it should also be verified end to end in the UI.

## Highest-Value Next Steps

### Advisor Weekly Digest

Send or generate a short weekly summary of students who need attention, such as:

- overdue meetings
- newly inactive students
- upcoming meetings
- recent phase changes

This could start as a downloadable report and later grow into scheduled email delivery.

### Student Risk Flags

Highlight students who may need intervention, for example when they have:

- no recent meeting activity
- stalled phase progress
- repeated missed or slipping deadlines

This would make the dashboard more proactive instead of purely descriptive.

### Timeline View

Add a compact per-student timeline showing:

- start date
- phase changes
- meetings
- derived target submission timing

This would make it easier to understand progress at a glance without reading the full log history.

## Additional Ideas

### Notes Templates

Provide reusable meeting-note templates such as:

- kickoff
- research plan review
- final draft review

### Phase Aging Insights

Show how long students typically stay in each phase and highlight outliers.

### Reminders

Add reminders for upcoming meetings or deadlines, either inside the dashboard or through email.

### CSV Import Cleanup Tools

Support column mapping, duplicate detection, and a preview step before importing.

### Student Attachment Links

Store useful links per student, such as shared drives, thesis documents, or submission portals.

### Bulk Updates

Allow updating multiple students at once for repetitive operations like phase changes.

### Saved Dashboard Presets

Let advisors save common filter combinations such as:

- my MSc students
- students needing attention this week
- students close to submission
