---
name: frontend-design
description: Create distinctive, production-grade frontend work for Thesis Journey Tracker. Use when building or redesigning pages, dashboard sections, shared UI components, HTMLisp views, or Tailwind styling, while preserving the app's established visual language unless the user asks for a broader redesign.
---

# Frontend Design

This project is a private thesis advising dashboard for small supervision teams. Frontend work should feel calm, credible, and intentionally designed for academic workflow, not like a generic SaaS template.

## Repo Context

- Runtime and rendering: Cloudflare Workers with server-rendered HTMLisp templates.
- Styling: Tailwind CSS v4 with theme tokens defined in `src/tailwind-input.css`.
- Shared UI primitives: `src/ui/`.
- Dashboard-specific rendering: `src/view/dashboard/`.
- Local reference surface: `/style-guide`, rendered from `src/view/style-guide.htmlisp.ts`.

## Workflow

1. Inspect the surrounding page and any shared primitives before designing.
2. Choose a clear visual direction that fits the request.
3. Reuse or extend shared UI helpers in `src/ui/` when a pattern appears more than once.
4. Keep theme tokens, spacing, and states consistent with `src/tailwind-input.css`.
5. If you touch shared primitives, verify the result against the local style guide as well as the page you changed.

## Design Direction

- Default tone: thoughtful, editorial, and quietly confident.
- Favor strong hierarchy, clean spacing, and expressive composition over decorative noise.
- Preserve the existing blue, slate, and semantic status palette unless the task is an intentional redesign.
- Avoid generic AI aesthetics: purple gradients, interchangeable SaaS cards, default system-font styling, or excessive glassmorphism.
- Use animation sparingly and purposefully. This app is primarily a productivity tool.

## Implementation Notes

- Prefer small, composable HTMLisp helpers over repeating large template blocks.
- Put reusable class recipes in `src/ui/styles.ts` when they will benefit multiple views.
- Keep mobile and desktop layouts both intentional; dashboard density should not come at the expense of readability.
- Comments should stay rare and only explain non-obvious logic.

## When To Stretch Further

Push the design harder when the user explicitly asks for a redesign, a more branded landing surface, or a stronger visual identity. In those cases, keep the result cohesive with the app's purpose and make the bold choice feel deliberate rather than flashy.
