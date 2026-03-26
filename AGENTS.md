# Project Rules

This file stores durable working rules for automated contributors operating in this repository.

## Documentation Maintenance

- Keep documentation in sync with the code whenever behavior, setup, or workflows change.
- Treat [`docs/roadmap.md`](./docs/roadmap.md) as a list of unfinished work only.
- When a roadmap item is completed, remove it or rewrite it to describe the remaining gap in the same task when practical.
- If a feature changes user-visible behavior, update the most relevant docs in the same change set when practical. This usually means [`README.md`](./README.md) plus any affected file under [`docs/`](./docs/).

## Roadmap Hygiene

- Keep `Current Priority Items` focused on the next real follow-up tasks.
- Avoid leaving recently completed work in the roadmap just because it was implemented in a separate commit.
- Prefer concise roadmap entries that describe the remaining problem, not implementation history.

## Frontend Design

- Use the project-local [`frontend-design`](./.codex/skills/frontend-design/SKILL.md) skill for substantial UI work such as page redesigns, dashboard polish, new view composition, or shared component styling.
- Treat the skill as guidance for preserving the app's established visual language unless the user explicitly asks for a broader redesign.
