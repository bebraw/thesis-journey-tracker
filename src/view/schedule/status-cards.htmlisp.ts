import { raw } from "../../htmlisp";
import { MUTED_TEXT, SUBTLE_TEXT, TEXT_LINK, renderButton, renderCard } from "../../ui";
import { renderView } from "../shared.htmlisp";

export function renderScheduleSetupCard(): string {
  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Google Calendar Setup Needed</h2>
      <p &class="subtleText" &children="description"></p>
      <ul class="mt-panel-sm list-disc space-y-badge-y pl-panel-sm text-sm">
        <li>Full scheduling: Google client ID, client secret, refresh token, and Google Calendar ID</li>
        <li>Simpler fallback: Google Calendar Secret address in iCal format</li>
      </ul>
      <p class="mt-panel-sm text-sm">
        Save either setup option from the <a href="/data-tools" class="${TEXT_LINK}">Data Tools</a> page.
      </p>
      <div class="mt-panel-sm flex flex-wrap gap-stack-xs">
        <fragment &children="openDataToolsButton"></fragment>
        <fragment &children="backToDashboardButton"></fragment>
      </div>
      <p &class="metaText" &children="timezoneNote"></p>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        metaText: `mt-panel-sm ${MUTED_TEXT}`,
        description:
          "Add either full Google OAuth refresh-token credentials for scheduling or a read-only Google Calendar iCal link for availability fallback.",
        timezoneNote: "Optional: save a timezone such as Europe/Helsinki if you want the displayed week and created events to use a specific calendar timezone.",
        openDataToolsButton: raw(renderButton({
          label: "Open Data Tools",
          href: "/data-tools",
          variant: "primary",
        })),
        backToDashboardButton: raw(renderButton({
          label: "Back to dashboard",
          href: "/",
          variant: "neutral",
        })),
      },
    ),
  );
}

export function renderScheduleSyncFailureCard(): string {
  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Google Calendar Sync Unavailable</h2>
      <p &class="subtleText" &children="description"></p>
      <div class="mt-panel-sm flex flex-wrap gap-stack-xs">
        <fragment &children="openDataToolsButton"></fragment>
        <fragment &children="backToDashboardButton"></fragment>
      </div>
      <p &class="metaText" &children="helpText"></p>`,
      {
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        metaText: `mt-panel-sm ${MUTED_TEXT}`,
        description:
          "The calendar grid is hidden until Google Calendar sync succeeds again, so you do not accidentally schedule from incomplete availability data.",
        openDataToolsButton: raw(renderButton({
          label: "Update Data Tools settings",
          href: "/data-tools",
          variant: "primary",
        })),
        backToDashboardButton: raw(renderButton({
          label: "Back to dashboard",
          href: "/",
          variant: "neutral",
        })),
        helpText: "Check the error message above, then update the saved credentials in Data Tools or try again later.",
      },
    ),
  );
}
