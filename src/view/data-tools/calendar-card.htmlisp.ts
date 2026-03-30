import { escapeHtml } from "../../formatting";
import { FIELD_CONTROL_SM, FORM_LABEL, MUTED_TEXT, SUBTLE_TEXT, TEXT_LINK, renderButton, renderCard } from "../../ui";
import { renderView } from "../shared.htmlisp";
import type { DataToolsPageData } from "../types";

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

  return renderCard(
    renderView(
      `<h2 class="text-lg font-semibold">Google Calendar Credentials</h2>
      <p &class="(get props subtleText)" &children="(get props description)"></p>
      <div class="mt-panel-sm space-y-badge-y text-sm">
        <p &class="(get props metaText)" &children="(get props statusText)"></p>
        <p &class="(get props metaText)" &visibleIf="(get props calendarIdVisible)" &children="(get props calendarIdText)"></p>
        <p &class="(get props metaText)" &visibleIf="(get props timeZoneVisible)" &children="(get props timeZoneText)"></p>
        <p &class="(get props metaText)" &visibleIf="(get props updatedAtVisible)" &children="(get props updatedAtText)"></p>
      </div>
      <div class="mt-panel-sm grid grid-cols-1 gap-panel-sm lg:grid-cols-2">
        <section class="rounded-card border border-app-line bg-app-surface-soft/75 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/35">
          <div class="flex items-start justify-between gap-stack-xs">
            <div>
              <h3 class="text-base font-semibold">Full scheduling mode</h3>
              <p class="mt-1 text-sm text-app-text-soft dark:text-app-text-soft-dark">
                Best when you want to view availability and create Google Calendar invitations from the app.
              </p>
            </div>
            <span class="rounded-control bg-app-success-soft px-badge-pill-x py-badge-pill-y text-xs font-medium text-app-success-text dark:bg-app-success-soft-dark/40 dark:text-app-success-text-dark">
              Recommended
            </span>
          </div>
          <ul class="mt-stack-xs list-disc space-y-badge-y pl-panel-sm text-sm">
            <li>Requires client ID, client secret, refresh token, and calendar ID.</li>
            <li>Lets advisors pick a slot and create the invite immediately.</li>
            <li>Works best when scheduling is a regular part of the workflow.</li>
          </ul>
          <div class="mt-stack-xs">
            <noop &children="(get props jumpToFullModeButton)"></noop>
          </div>
        </section>
        <section class="rounded-card border border-app-line bg-app-surface-soft/75 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/35">
          <div>
            <h3 class="text-base font-semibold">iCal fallback mode</h3>
            <p class="mt-1 text-sm text-app-text-soft dark:text-app-text-soft-dark">
              Best when you only need read-only availability and want the lightest setup.
            </p>
          </div>
          <ul class="mt-stack-xs list-disc space-y-badge-y pl-panel-sm text-sm">
            <li>Requires only Google Calendar&apos;s Secret address in iCal format.</li>
            <li>Shows availability but does not let the app create invitations.</li>
            <li>Useful as a fallback when OAuth setup is not worth the overhead.</li>
          </ul>
          <div class="mt-stack-xs">
            <noop &children="(get props jumpToIcalModeButton)"></noop>
          </div>
        </section>
      </div>
      <div class="mt-panel-sm grid grid-cols-1 gap-panel-sm xl:grid-cols-2 xl:items-start">
        <section id="calendarFullMode" class="rounded-card border border-app-line bg-app-surface-soft/75 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/35">
          <h3 class="text-base font-semibold">Full scheduling mode</h3>
          <p class="mt-1 text-sm text-app-text-soft dark:text-app-text-soft-dark">
            Save these when you want the schedule page to create Google Calendar events directly.
          </p>
          <form action="/actions/save-google-calendar-settings" method="post" class="mt-panel-sm space-y-stack-xs">
            <label &class="(get props formLabelClass)">
              <span>Google client ID</span>
              <input name="clientId" required="required" autocomplete="off" &class="(get props fieldClass)" &value="(get props clientIdValue)" />
            </label>
            <label &class="(get props formLabelClass)">
              <span>Google client secret</span>
              <input
                name="clientSecret"
                type="password"
                required="required"
                autocomplete="off"
                &class="(get props fieldClass)"
                &value="(get props clientSecretValue)"
              />
            </label>
            <label &class="(get props formLabelClass)">
              <span>Google refresh token</span>
              <input
                name="refreshToken"
                type="password"
                required="required"
                autocomplete="off"
                &class="(get props fieldClass)"
                &value="(get props refreshTokenValue)"
              />
            </label>
            <label &class="(get props formLabelClass)">
              <span>Google Calendar ID</span>
              <input name="calendarId" required="required" autocomplete="off" &class="(get props fieldClass)" &value="(get props calendarIdValue)" />
            </label>
            <label &class="(get props formLabelClass)">
              <span>Timezone (optional)</span>
              <input
                name="timeZone"
                placeholder="Europe/Helsinki"
                autocomplete="off"
                &class="(get props fieldClass)"
                &value="(get props timeZoneValue)"
              />
            </label>
            <noop &children="(get props saveButton)"></noop>
          </form>
          <form action="/actions/clear-google-calendar-oauth-settings" method="post" class="mt-stack-xs">
            <noop &children="(get props clearOAuthButton)"></noop>
          </form>
        </section>
        <section id="calendarIcalMode" class="rounded-card border border-app-line bg-app-surface-soft/75 p-panel-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/35">
          <h3 class="text-base font-semibold">iCal fallback mode</h3>
          <p class="mt-1 text-sm text-app-text-soft dark:text-app-text-soft-dark">
            Save this when you only need read-only availability and are happy to create invites outside the app.
          </p>
          <form action="/actions/save-google-calendar-ical-settings" method="post" class="mt-panel-sm space-y-stack-xs">
            <label &class="(get props formLabelClass)">
              <span>Google Calendar iCal URL</span>
              <input
                name="iCalUrl"
                required="required"
                autocomplete="off"
                &class="(get props fieldClass)"
                &value="(get props iCalUrlValue)"
              />
            </label>
            <label &class="(get props formLabelClass)">
              <span>Timezone (optional)</span>
              <input
                name="timeZone"
                placeholder="Europe/Helsinki"
                autocomplete="off"
                &class="(get props fieldClass)"
                &value="(get props timeZoneValue)"
              />
            </label>
            <noop &children="(get props saveIcalButton)"></noop>
          </form>
          <form action="/actions/clear-google-calendar-ical-settings" method="post" class="mt-stack-xs">
            <noop &children="(get props clearIcalButton)"></noop>
          </form>
        </section>
      </div>
      <details class="mt-panel-sm rounded-control border border-app-line bg-app-surface-soft p-panel-sm text-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/60">
        <summary class="cursor-pointer list-none font-semibold marker:content-['']">Need help finding OAuth values?</summary>
        <div class="mt-stack-xs">
          <ol class="list-decimal space-y-badge-y pl-panel-sm">
            <li>Create or choose a Google Cloud project and enable the Google Calendar API.</li>
            <li>Configure the OAuth consent screen in Google Auth Platform.</li>
            <li>Create a <strong>Web application</strong> OAuth client and, if you use OAuth Playground, add <code>https://developers.google.com/oauthplayground</code> as an authorized redirect URI.</li>
            <li>Copy the client ID and client secret from that OAuth client.</li>
            <li>Open <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" class="${escapeHtml(TEXT_LINK)}">Google OAuth 2.0 Playground</a>, enable <code>Use your own OAuth credentials</code>, authorize exactly <code>https://www.googleapis.com/auth/calendar.events</code>, exchange the code, and copy the refresh token.</li>
            <li>For the calendar ID, either use <code>primary</code> or open Google Calendar and copy the value from <code>Settings and sharing</code> -> <code>Integrate calendar</code> -> <code>Calendar ID</code>.</li>
            <li>Timezone is optional. Use an IANA timezone such as <code>Europe/Helsinki</code>.</li>
          </ol>
          <p class="mt-stack-xs text-app-text-muted dark:text-app-text-muted-dark">
            If you want the longer step-by-step version, see the repository setup guide.
          </p>
        </div>
      </details>
      <details class="mt-stack-xs rounded-control border border-app-line bg-app-surface-soft p-panel-sm text-sm dark:border-app-line-dark dark:bg-app-surface-soft-dark/60">
        <summary class="cursor-pointer list-none font-semibold marker:content-['']">What the iCal fallback can and cannot do</summary>
        <p class="mt-stack-xs text-app-text-muted dark:text-app-text-muted-dark">
          Google Calendar provides a <code>Secret address in iCal format</code> under <code>Settings and sharing</code> -> <code>Integrate calendar</code>. This app can use that link as an easier fallback mode, but it cannot create invitations from the app while using it.
        </p>
      </details>
      <form action="/actions/clear-google-calendar-settings" method="post" class="mt-panel-sm">
        <noop &children="(get props clearButton)"></noop>
      </form>
      <p &class="(get props metaText)" &children="(get props encryptionNote)"></p>`,
      {
        subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
        metaText: escapeHtml(`mt-panel-sm ${MUTED_TEXT}`),
        description: escapeHtml(
          "Choose either full OAuth scheduling or the easier iCal fallback. The app encrypts the saved values before storing them in D1.",
        ),
        statusText: escapeHtml(
          googleCalendarConfigSource === "stored_api"
            ? "Active source: encrypted full Google Calendar scheduling credentials."
            : googleCalendarConfigSource === "stored_ical"
              ? "Active source: encrypted Google Calendar iCal fallback link."
              : "Active source: not configured yet.",
        ),
        calendarIdVisible: Boolean(effectiveGoogleCalendarId),
        calendarIdText: escapeHtml(`Current calendar ID: ${effectiveGoogleCalendarId || ""}`),
        timeZoneVisible: Boolean(effectiveGoogleCalendarTimeZone),
        timeZoneText: escapeHtml(`Current timezone: ${effectiveGoogleCalendarTimeZone || ""}`),
        updatedAtVisible: Boolean(storedGoogleCalendarUpdatedAt),
        updatedAtText: escapeHtml(`Stored credentials last updated: ${storedGoogleCalendarUpdatedAt || ""}`),
        formLabelClass: escapeHtml(FORM_LABEL),
        fieldClass: escapeHtml(`mt-1 ${FIELD_CONTROL_SM}`),
        clientIdValue: escapeHtml(googleCalendarClientId),
        clientSecretValue: escapeHtml(googleCalendarClientSecret),
        refreshTokenValue: escapeHtml(googleCalendarRefreshToken),
        calendarIdValue: escapeHtml(googleCalendarCalendarId),
        iCalUrlValue: escapeHtml(googleCalendarIcalUrl),
        timeZoneValue: escapeHtml(googleCalendarTimeZone),
        jumpToFullModeButton: renderButton({
          label: "Set up full scheduling",
          href: "#calendarFullMode",
          variant: "primary",
        }),
        jumpToIcalModeButton: renderButton({
          label: "Set up iCal fallback",
          href: "#calendarIcalMode",
          variant: "neutral",
        }),
        saveButton: renderButton({
          label: "Save encrypted credentials",
          type: "submit",
          variant: "primaryBlock",
        }),
        clearOAuthButton: renderButton({
          label: "Remove full scheduling credentials",
          type: "submit",
          variant: "neutral",
        }),
        saveIcalButton: renderButton({
          label: "Save iCal fallback",
          type: "submit",
          variant: "primaryBlock",
        }),
        clearIcalButton: renderButton({
          label: "Remove iCal fallback",
          type: "submit",
          variant: "neutral",
        }),
        clearButton: renderButton({
          label: "Clear stored calendar settings",
          type: "submit",
          variant: "neutral",
        }),
        encryptionNote: escapeHtml(
          "Saved calendar settings are encrypted before they are written to the database. Set APP_ENCRYPTION_SECRET in the Worker environment if you want that encryption key to be separate from SESSION_SECRET.",
        ),
      },
    ),
  );
}
