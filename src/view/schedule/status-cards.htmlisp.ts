import { raw } from "../../htmlisp";
import { MUTED_TEXT, SUBTLE_TEXT, TEXT_LINK, renderButton, renderCard } from "../../ui";
import { renderView } from "../shared.htmlisp";

interface ScheduleStatusCardOptions {
  title: string;
  description: string;
  metaText: string;
  primaryLabel: string;
  showSetupList?: boolean;
}

function renderScheduleStatusCard(options: ScheduleStatusCardOptions): string {
  const { title, description, metaText, primaryLabel, showSetupList = false } = options;

  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold" &children="title"></h2>
      <p &class="subtleText" &children="description"></p>
      <ul &visibleIf="showSetupList" class="mt-panel-sm list-disc space-y-badge-y pl-panel-sm text-sm">
        <li>Full scheduling: Google client ID, client secret, refresh token, and Google Calendar ID</li>
        <li>Simpler fallback: Google Calendar Secret address in iCal format</li>
      </ul>
      <p &visibleIf="showSetupList" class="mt-panel-sm text-sm">
        Save either setup option from the <a href="/data-tools" class="${TEXT_LINK}">Data Tools</a> page.
      </p>
      <div class="mt-panel-sm flex flex-wrap gap-stack-xs">
        <fragment &children="openDataToolsButton"></fragment>
        <fragment &children="backToDashboardButton"></fragment>
      </div>
      <p &class="metaTextClass" &children="metaText"></p>`,
      {
        title,
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        description,
        showSetupList,
        metaTextClass: `mt-panel-sm ${MUTED_TEXT}`,
        metaText,
        openDataToolsButton: raw(renderButton({
          label: primaryLabel,
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

export function renderScheduleSetupCard(): string {
  return renderScheduleStatusCard({
    title: "Google Calendar Setup Needed",
    description:
      "Add either full Google OAuth refresh-token credentials for scheduling or a read-only Google Calendar iCal link for availability fallback.",
    metaText:
      "Optional: save a timezone such as Europe/Helsinki if you want the displayed week and created events to use a specific calendar timezone.",
    primaryLabel: "Open Data Tools",
    showSetupList: true,
  });
}

export function renderScheduleSyncFailureCard(): string {
  return renderScheduleStatusCard({
    title: "Google Calendar Sync Unavailable",
    description:
      "The calendar grid is hidden until Google Calendar sync succeeds again, so you do not accidentally schedule from incomplete availability data.",
    metaText: "Check the error message above, then update the saved credentials in Data Tools or try again later.",
    primaryLabel: "Update Data Tools settings",
  });
}
