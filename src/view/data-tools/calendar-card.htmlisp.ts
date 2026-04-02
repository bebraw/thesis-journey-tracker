import { raw } from "../../htmlisp";
import {
  DANGER_PANEL,
  DANGER_TEXT,
  DANGER_TITLE,
  FIELD_CONTROL_SM,
  MUTED_TEXT,
  SUBTLE_TEXT,
  TEXT_LINK,
  renderButton,
  renderCard,
  renderDisclosure,
  renderInputField,
  renderInsetCard,
  renderSectionHeader,
} from "../../ui";
import { renderView } from "../shared.htmlisp";
import type { DataToolsPageData } from "../types";

function renderCalendarModeSummaryCard(
  title: string,
  description: string,
  bulletItems: string[],
  buttonHtml: string,
  badgeText?: string,
): string {
  return renderInsetCard(
    renderView(
      `<div class="flex items-start justify-between gap-stack-xs">
        <div>
          <h3 class="text-base font-semibold" &children="title"></h3>
          <p class="mt-1 text-sm text-app-text-soft dark:text-app-text-soft-dark" &children="description"></p>
        </div>
        <span
          &visibleIf="badgeVisible"
          class="rounded-control bg-app-success-soft px-badge-pill-x py-badge-pill-y text-xs font-medium text-app-success-text dark:bg-app-success-soft-dark/40 dark:text-app-success-text-dark"
          &children="badgeText"
        ></span>
      </div>
      <ul class="mt-stack-xs list-disc space-y-badge-y pl-panel-sm text-sm">
        <fragment &foreach="bulletItems as bulletItem">
          <li &children="bulletItem"></li>
        </fragment>
      </ul>
      <div class="mt-stack-xs">
        <fragment &children="buttonHtml"></fragment>
      </div>`,
      {
        title,
        description,
        badgeVisible: Boolean(badgeText),
        badgeText: badgeText || "",
        bulletItems,
        buttonHtml: raw(buttonHtml),
      },
    ),
  );
}

export function renderGoogleCalendarCard(data: DataToolsPageData): string {
  const {
    googleCalendarConfigSource,
    storedGoogleCalendarUpdatedAt,
    effectiveGoogleCalendarId,
    effectiveGoogleCalendarTimeZone,
    googleCalendarClientId,
    googleCalendarClientSecret,
    googleCalendarRefreshToken,
    googleCalendarCalendarId,
    googleCalendarIcalUrl,
    googleCalendarTimeZone,
  } = data;

  const fullSchedulingSummaryHtml = renderCalendarModeSummaryCard(
    "Full scheduling mode",
    "Best when you want to view availability and create Google Calendar invitations from the app.",
    [
      "Requires client ID, client secret, refresh token, and calendar ID.",
      "Lets advisors pick a slot and create the invite immediately.",
      "Works best when scheduling is a regular part of the workflow.",
    ],
    renderButton({
      label: "Set up full scheduling",
      href: "#calendarFullMode",
      variant: "primary",
    }),
    "Recommended",
  );

  const icalSummaryHtml = renderCalendarModeSummaryCard(
    "iCal fallback mode",
    "Best when you only need read-only availability and want the lightest setup.",
    [
      "Requires only Google Calendar's Secret address in iCal format.",
      "Shows availability but does not let the app create invitations.",
      "Useful as a fallback when OAuth setup is not worth the overhead.",
    ],
    renderButton({
      label: "Set up iCal fallback",
      href: "#calendarIcalMode",
      variant: "neutral",
    }),
  );

  const clientIdFieldHtml = renderInputField({
    label: "Google client ID",
    name: "clientId",
    required: true,
    value: googleCalendarClientId,
    className: FIELD_CONTROL_SM,
    attrs: {
      autocomplete: "off",
    },
  });
  const clientSecretFieldHtml = renderInputField({
    label: "Google client secret",
    name: "clientSecret",
    type: "password",
    required: true,
    value: googleCalendarClientSecret,
    className: FIELD_CONTROL_SM,
    attrs: {
      autocomplete: "off",
    },
  });
  const refreshTokenFieldHtml = renderInputField({
    label: "Google refresh token",
    name: "refreshToken",
    type: "password",
    required: true,
    value: googleCalendarRefreshToken,
    className: FIELD_CONTROL_SM,
    attrs: {
      autocomplete: "off",
    },
  });
  const calendarIdFieldHtml = renderInputField({
    label: "Google Calendar ID",
    name: "calendarId",
    required: true,
    value: googleCalendarCalendarId,
    className: FIELD_CONTROL_SM,
    attrs: {
      autocomplete: "off",
    },
  });
  const timeZoneFieldHtml = renderInputField({
    label: "Timezone (optional)",
    name: "timeZone",
    value: googleCalendarTimeZone,
    placeholder: "Europe/Helsinki",
    className: FIELD_CONTROL_SM,
    attrs: {
      autocomplete: "off",
    },
  });
  const icalUrlFieldHtml = renderInputField({
    label: "Google Calendar iCal URL",
    name: "iCalUrl",
    required: true,
    value: googleCalendarIcalUrl,
    className: FIELD_CONTROL_SM,
    attrs: {
      autocomplete: "off",
    },
  });

  const fullModeSectionHtml = renderInsetCard(
    renderView(
      `<fragment &children="headerHtml"></fragment>
      <form action="/actions/save-google-calendar-settings" method="post" class="mt-panel-sm space-y-stack-xs">
        <fragment &children="clientIdFieldHtml"></fragment>
        <fragment &children="clientSecretFieldHtml"></fragment>
        <fragment &children="refreshTokenFieldHtml"></fragment>
        <fragment &children="calendarIdFieldHtml"></fragment>
        <fragment &children="timeZoneFieldHtml"></fragment>
        <fragment &children="saveButton"></fragment>
      </form>
      <div &class="scopedDangerPanelClass">
        <h4 &class="scopedDangerTitleClass">Remove full scheduling credentials</h4>
        <p &class="scopedDangerTextClass">
          Use this if you want to disable invitation creation but keep any iCal fallback settings untouched.
        </p>
        <form action="/actions/clear-google-calendar-oauth-settings" method="post" class="mt-stack-xs">
          <fragment &children="clearOAuthButton"></fragment>
        </form>
      </div>`,
      {
        headerHtml: raw(renderSectionHeader({
          title: "Full scheduling mode",
          meta: "Create Google Calendar events from the schedule page",
        })),
        clientIdFieldHtml: raw(clientIdFieldHtml),
        clientSecretFieldHtml: raw(clientSecretFieldHtml),
        refreshTokenFieldHtml: raw(refreshTokenFieldHtml),
        calendarIdFieldHtml: raw(calendarIdFieldHtml),
        timeZoneFieldHtml: raw(timeZoneFieldHtml),
        saveButton: raw(renderButton({
          label: "Save encrypted credentials",
          type: "submit",
          variant: "primaryBlock",
        })),
        clearOAuthButton: raw(renderButton({
          label: "Remove full scheduling credentials",
          type: "submit",
          variant: "neutral",
        })),
        scopedDangerPanelClass:
          "mt-panel-sm rounded-control border border-app-danger-line/70 bg-app-danger-soft/45 p-panel-sm dark:border-app-danger-line-dark/40 dark:bg-app-danger-soft-dark/20",
        scopedDangerTitleClass: "text-sm font-semibold text-app-danger-text dark:text-app-danger-text-dark",
        scopedDangerTextClass: "mt-1 text-sm text-app-danger-text dark:text-app-danger-text-dark",
      },
    ),
    undefined,
    { id: "calendarFullMode" },
  );

  const icalModeSectionHtml = renderInsetCard(
    renderView(
      `<fragment &children="headerHtml"></fragment>
      <form action="/actions/save-google-calendar-ical-settings" method="post" class="mt-panel-sm space-y-stack-xs">
        <fragment &children="icalUrlFieldHtml"></fragment>
        <fragment &children="timeZoneFieldHtml"></fragment>
        <fragment &children="saveIcalButton"></fragment>
      </form>
      <div &class="scopedDangerPanelClass">
        <h4 &class="scopedDangerTitleClass">Remove iCal fallback</h4>
        <p &class="scopedDangerTextClass">
          Use this if you no longer want the app to read availability from the fallback iCal link.
        </p>
        <form action="/actions/clear-google-calendar-ical-settings" method="post" class="mt-stack-xs">
          <fragment &children="clearIcalButton"></fragment>
        </form>
      </div>`,
      {
        headerHtml: raw(renderSectionHeader({
          title: "iCal fallback mode",
          meta: "Read-only availability with the lightest setup",
        })),
        icalUrlFieldHtml: raw(icalUrlFieldHtml),
        timeZoneFieldHtml: raw(timeZoneFieldHtml),
        saveIcalButton: raw(renderButton({
          label: "Save iCal fallback",
          type: "submit",
          variant: "primaryBlock",
        })),
        clearIcalButton: raw(renderButton({
          label: "Remove iCal fallback",
          type: "submit",
          variant: "neutral",
        })),
        scopedDangerPanelClass:
          "mt-panel-sm rounded-control border border-app-danger-line/70 bg-app-danger-soft/45 p-panel-sm dark:border-app-danger-line-dark/40 dark:bg-app-danger-soft-dark/20",
        scopedDangerTitleClass: "text-sm font-semibold text-app-danger-text dark:text-app-danger-text-dark",
        scopedDangerTextClass: "mt-1 text-sm text-app-danger-text dark:text-app-danger-text-dark",
      },
    ),
    undefined,
    { id: "calendarIcalMode" },
  );

  const oauthHelpDisclosureHtml = renderDisclosure({
    summary: "Need help finding OAuth values?",
    className: "mt-panel-sm",
    content: `<ol class="list-decimal space-y-badge-y pl-panel-sm">
        <li>Create or choose a Google Cloud project and enable the Google Calendar API.</li>
        <li>Configure the OAuth consent screen in Google Auth Platform.</li>
        <li>Create a <strong>Web application</strong> OAuth client and, if you use OAuth Playground, add <code>https://developers.google.com/oauthplayground</code> as an authorized redirect URI.</li>
        <li>Copy the client ID and client secret from that OAuth client.</li>
        <li>Open <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" class="${TEXT_LINK}">Google OAuth 2.0 Playground</a>, enable <code>Use your own OAuth credentials</code>, authorize exactly <code>https://www.googleapis.com/auth/calendar.events</code>, exchange the code, and copy the refresh token.</li>
        <li>For the calendar ID, either use <code>primary</code> or open Google Calendar and copy the value from <code>Settings and sharing</code> -> <code>Integrate calendar</code> -> <code>Calendar ID</code>.</li>
        <li>Timezone is optional. Use an IANA timezone such as <code>Europe/Helsinki</code>.</li>
      </ol>
      <p class="mt-stack-xs text-app-text-muted dark:text-app-text-muted-dark">
        If you want the longer step-by-step version, see the repository setup guide.
      </p>`,
  });

  const icalHelpDisclosureHtml = renderDisclosure({
    summary: "What the iCal fallback can and cannot do",
    className: "mt-stack-xs",
    content:
      '<p class="text-app-text-muted dark:text-app-text-muted-dark">Google Calendar provides a <code>Secret address in iCal format</code> under <code>Settings and sharing</code> -> <code>Integrate calendar</code>. This app can use that link as an easier fallback mode, but it cannot create invitations from the app while using it.</p>',
  });

  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Google Calendar Credentials</h2>
      <p &class="subtleText" &children="description"></p>
      <div class="mt-panel-sm space-y-badge-y text-sm">
        <p &class="metaText" &children="statusText"></p>
        <p &class="metaText" &visibleIf="calendarIdVisible" &children="calendarIdText"></p>
        <p &class="metaText" &visibleIf="timeZoneVisible" &children="timeZoneText"></p>
        <p &class="metaText" &visibleIf="updatedAtVisible" &children="updatedAtText"></p>
      </div>
      <div class="mt-panel-sm grid grid-cols-1 gap-panel-sm lg:grid-cols-2">
        <fragment &children="fullSchedulingSummaryHtml"></fragment>
        <fragment &children="icalSummaryHtml"></fragment>
      </div>
      <div class="mt-panel-sm grid grid-cols-1 gap-panel-sm xl:grid-cols-2 xl:items-start">
        <fragment &children="fullModeSectionHtml"></fragment>
        <fragment &children="icalModeSectionHtml"></fragment>
      </div>
      <fragment &children="oauthHelpDisclosureHtml"></fragment>
      <fragment &children="icalHelpDisclosureHtml"></fragment>
      <section &class="dangerPanelClass">
        <h3 &class="dangerTitleClass">Clear all saved calendar settings</h3>
        <p &class="dangerTextClass">
          This removes both full scheduling credentials and the iCal fallback at once, leaving scheduling unconfigured.
        </p>
        <form action="/actions/clear-google-calendar-settings" method="post" class="mt-panel-sm">
          <fragment &children="clearButton"></fragment>
        </form>
      </section>
      <p &class="metaText" &children="encryptionNote"></p>`,
      {
        dangerPanelClass: `${DANGER_PANEL} mt-panel-sm`,
        dangerTitleClass: DANGER_TITLE,
        dangerTextClass: DANGER_TEXT,
        subtleText: `mt-1 ${SUBTLE_TEXT}`,
        metaText: `mt-panel-sm ${MUTED_TEXT}`,
        description:
          "Choose either full OAuth scheduling or the easier iCal fallback. The app encrypts the saved values before storing them in D1.",
        statusText:
          googleCalendarConfigSource === "stored_api"
            ? "Active source: encrypted full Google Calendar scheduling credentials."
            : googleCalendarConfigSource === "stored_ical"
              ? "Active source: encrypted Google Calendar iCal fallback link."
              : "Active source: not configured yet.",
        calendarIdVisible: Boolean(effectiveGoogleCalendarId),
        calendarIdText: `Current calendar ID: ${effectiveGoogleCalendarId || ""}`,
        timeZoneVisible: Boolean(effectiveGoogleCalendarTimeZone),
        timeZoneText: `Current timezone: ${effectiveGoogleCalendarTimeZone || ""}`,
        updatedAtVisible: Boolean(storedGoogleCalendarUpdatedAt),
        updatedAtText: `Stored credentials last updated: ${storedGoogleCalendarUpdatedAt || ""}`,
        fullSchedulingSummaryHtml: raw(fullSchedulingSummaryHtml),
        icalSummaryHtml: raw(icalSummaryHtml),
        fullModeSectionHtml: raw(fullModeSectionHtml),
        icalModeSectionHtml: raw(icalModeSectionHtml),
        oauthHelpDisclosureHtml: raw(oauthHelpDisclosureHtml),
        icalHelpDisclosureHtml: raw(icalHelpDisclosureHtml),
        clearButton: raw(renderButton({
          label: "Clear stored calendar settings",
          type: "submit",
          variant: "dangerBlock",
        })),
        encryptionNote:
          "Saved calendar settings are encrypted before they are written to the database. Set APP_ENCRYPTION_SECRET in the Worker environment if you want that encryption key to be separate from SESSION_SECRET.",
      },
    ),
  );
}
