import { escapeHtml } from "../../formatting";
import { MUTED_TEXT, SUBTLE_TEXT, TEXT_LINK, renderCard } from "../../ui";
import { renderView } from "../shared.htmlisp";

export function renderScheduleSetupCard(): string {
  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Google Calendar Setup Needed</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <ul class="mt-panel-sm list-disc space-y-badge-y pl-panel-sm text-sm">
        <li>Full scheduling: Google client ID, client secret, refresh token, and Google Calendar ID</li>
        <li>Simpler fallback: Google Calendar Secret address in iCal format</li>
      </ul>
      <p class="mt-panel-sm text-sm">
        Save either setup option from the <a href="/data-tools" class="${escapeHtml(TEXT_LINK)}">Data Tools</a> page.
      </p>
      <p &class="(get props metaText)" &children="(get props timezoneNote)"></p>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        metaText: escapeHtml(`mt-panel-sm ${MUTED_TEXT}`),
        description: escapeHtml(
          "Add either full Google OAuth refresh-token credentials for scheduling or a read-only Google Calendar iCal link for availability fallback.",
        ),
        timezoneNote: escapeHtml("Optional: save a timezone such as Europe/Helsinki if you want the displayed week and created events to use a specific calendar timezone."),
      },
    ),
  );
}

export function renderScheduleSyncFailureCard(): string {
  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Google Calendar Sync Unavailable</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <p &class="(get props metaText)" &children="(get props helpText)"></p>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        metaText: escapeHtml(`mt-panel-sm ${MUTED_TEXT}`),
        description: escapeHtml(
          "The calendar grid is hidden until Google Calendar sync succeeds again, so you do not accidentally schedule from incomplete availability data.",
        ),
        helpText: escapeHtml("Check the error message above, then update the saved credentials in Data Tools or try again later."),
      },
    ),
  );
}
