# Product Roadmap

This note tracks the next product bets for Thesis Journey Tracker. Keep it focused on unfinished work: when an item ships, remove it or rewrite it to describe the remaining gap.

## Current Priority Items

- Put a stronger authentication boundary in front of the Workers-limited `100000`-iteration PBKDF2 verifier, preferably Cloudflare Access or the first phase of the documented passkey plan.
- Build student risk flags so the dashboard can surface students who need advisor attention instead of only showing the current cohort state.
- Validate [`src/ui/foundation/`](../src/ui/foundation) against a second real consumer before moving it into a separate repository or package. The in-repo foundation/app split is now in place, so the remaining gap is proving the API outside this app.

## Near-Term Roadmap

### 1. Student Risk Flags

Highlight students who may need intervention, for example when they have:

- no recent meeting activity
- overdue follow-up meetings
- stalled phase progress
- repeated missed or slipping deadlines
- expected submission timing that appears to be drifting

The first version should be small and explainable:

- calculate a few deterministic risk reasons from existing student, phase, and meeting data
- show the reasons in the student list and selected student workspace
- add a `Needs attention` dashboard filter
- keep thresholds configurable in code until real usage shows which settings deserve UI controls

This is the highest-value next feature because it turns the dashboard from descriptive tracking into an advisor attention system.

### 2. Timeline View

Add a compact per-student timeline showing:

- start date
- phase changes
- supervision meetings
- follow-up dates
- derived target submission timing

The timeline should live in the selected student workspace so an advisor can understand why a student is flagged without reading every log entry manually.

### 3. Advisor Weekly Digest

Generate a short weekly summary of students who need attention, such as:

- students with active risk flags
- overdue meetings
- newly inactive students
- upcoming meetings
- recent phase changes

Start as a downloadable Markdown or HTML report, then consider scheduled email delivery after the content proves useful.

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
