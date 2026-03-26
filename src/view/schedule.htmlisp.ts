import {
  EMPTY_DASHED_CARD,
  FIELD_CONTROL_SM,
  FORM_LABEL,
  MUTED_TEXT,
  PAGE_WRAP,
  SUBTLE_TEXT,
  SURFACE_CARD,
  SURFACE_CARD_SM,
  TEXT_LINK,
  renderButton,
  renderCard,
} from "../ui";
import { escapeHtml } from "../utils";
import { THEME_TOGGLE_SCRIPT, renderAuthedPageHeader, renderDocument, renderFlashMessages, renderView } from "./shared.htmlisp";
import type { SchedulePageData } from "./types";

export function renderSchedulePage(data: SchedulePageData): string {
  const {
    viewer,
    notice,
    error,
    showStyleGuide,
    configured,
    sourceMode,
    syncFailed,
    timeZone,
    weekLabel,
    prevWeekHref,
    nextWeekHref,
    currentWeekHref,
    selectedWeek,
    selectedSlotHref,
    students,
    selectedStudentId,
    selectedStudentName,
    selectedStudentEmail,
    selectedSlotLabel,
    selectedSlotStart,
    selectedSlotEnd,
    defaultTitle,
    defaultDescription,
    days,
  } = data;

  const scheduleControlsCard = renderCard(
    renderView(
      `<div class="flex flex-col gap-stack-xs xl:flex-row xl:items-end xl:justify-between">
        <form action="/schedule" method="get" class="grid flex-1 grid-cols-1 gap-stack-xs sm:grid-cols-[minmax(0,20rem)_auto]">
          <label &class="(get props formLabelClass)">
            <span>Student</span>
            <select name="student" &class="(get props fieldClass)">
              <option value="">Choose a student</option>
              <noop &foreach="(get props studentOptions)">
                <option &value="(get props value)" &selected="(get props selectedAttr)" &children="(get props label)"></option>
              </noop>
            </select>
          </label>
          <input type="hidden" name="week" &value="(get props selectedWeek)" />
          <noop &children="(get props applyButton)"></noop>
        </form>
        <div class="flex flex-wrap items-center gap-stack-xs">
          <noop &children="(get props prevButton)"></noop>
          <noop &children="(get props currentButton)"></noop>
          <noop &children="(get props nextButton)"></noop>
        </div>
      </div>
      <p &class="(get props subtleText)" &children="(get props helperText)"></p>`,
      {
        formLabelClass: escapeHtml(FORM_LABEL),
        fieldClass: escapeHtml(`mt-1 ${FIELD_CONTROL_SM}`),
        selectedWeek: escapeHtml(selectedWeek),
        studentOptions: students.map((student) => ({
          value: escapeHtml(student.value),
          label: escapeHtml(student.label),
          selectedAttr: student.selected ? "selected" : null,
        })),
        applyButton: renderButton({
          label: "Show schedule",
          type: "submit",
          variant: "primaryBlock",
          className: "sm:self-end sm:w-auto sm:px-panel-sm",
        }),
        prevButton: renderButton({
          label: "Previous week",
          href: prevWeekHref,
          variant: "neutral",
        }),
        currentButton: renderButton({
          label: "Current week",
          href: currentWeekHref,
          variant: "neutral",
        }),
        nextButton: renderButton({
          label: "Next week",
          href: nextWeekHref,
          variant: "neutral",
        }),
        subtleText: escapeHtml(`mt-stack-xs ${SUBTLE_TEXT}`),
        helperText: escapeHtml(
          sourceMode === "ical"
            ? selectedStudentId
              ? `Viewing Google Calendar iCal availability for ${selectedStudentName || "the selected student"} in ${timeZone}. This fallback mode is read-only.`
              : `Viewing Google Calendar iCal availability in ${timeZone}. Choose a student to compare availability against your supervision list.`
            : selectedStudentId
              ? `Scheduling for ${selectedStudentName || "the selected student"} in ${timeZone}. Pick an open slot to prepare a Google Calendar invitation.`
              : `Viewing Google Calendar availability in ${timeZone}. Choose a student, then pick an open slot.`,
        ),
      },
    ),
  );

  const calendarCard = renderCard(
    renderView(
      `<div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold">Calendar Week</h2>
          <p &class="(get props subtleText)" &children="(get props weekText)"></p>
        </div>
        <p &class="(get props metaText)" &children="(get props timezoneText)"></p>
      </div>
      <div class="mt-panel-sm grid grid-cols-1 gap-panel-sm lg:grid-cols-5">
        <noop &foreach="(get props days)">
          <section &class="(get props dayCardClass)">
            <div class="flex items-center justify-between gap-stack-xs">
              <h3 class="text-sm font-semibold" &children="(get props label)"></h3>
              <span class="text-xs text-app-text-muted dark:text-app-text-muted-dark">
                <span &children="(get props slotCountText)"></span>
              </span>
            </div>
            <div class="mt-stack-xs space-y-stack-xs">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-app-text-muted dark:text-app-text-muted-dark">Existing events</p>
                <div class="mt-badge-y space-y-badge-y" &visibleIf="(get props hasEvents)">
                  <noop &foreach="(get props events)">
                    <article class="rounded-control border border-app-line bg-app-surface-soft px-control-x py-badge-pill-y text-xs dark:border-app-line-dark dark:bg-app-surface-soft-dark/60">
                      <p class="font-semibold" &children="(get props summary)"></p>
                      <p class="mt-1 text-app-text-soft dark:text-app-text-soft-dark" &children="(get props timeText)"></p>
                      <p class="mt-1 text-app-text-muted dark:text-app-text-muted-dark" &visibleIf="(get props descriptionVisible)" &children="(get props description)"></p>
                      <a
                        &visibleIf="(get props linkVisible)"
                        &href="(get props htmlLink)"
                        target="_blank"
                        rel="noreferrer"
                        &class="(get props linkClass)"
                      >Open in Google Calendar</a>
                    </article>
                  </noop>
                </div>
                <p &visibleIf="(get props showNoEvents)" &class="(get props emptyStateClass)">No existing Google Calendar events in this day.</p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-app-text-muted dark:text-app-text-muted-dark">Available slots</p>
                <div class="mt-badge-y flex flex-wrap gap-badge-y" &visibleIf="(get props hasSlots)">
                  <noop &foreach="(get props slots)">
                    <a
                      &href="(get props href)"
                      &class="(get props slotClass)"
                      &aria-current="(get props currentAttr)"
                      &children="(get props label)"
                    ></a>
                  </noop>
                </div>
                <p &visibleIf="(get props showNoSlots)" &class="(get props emptyStateClass)">No one-hour slots remain in the default workday.</p>
              </div>
            </div>
          </section>
        </noop>
      </div>`,
      {
        subtleText: escapeHtml(SUBTLE_TEXT),
        metaText: escapeHtml(MUTED_TEXT),
        weekText: escapeHtml(weekLabel),
        timezoneText: escapeHtml(`Google Calendar timezone: ${timeZone}`),
        dayCardClass: escapeHtml(SURFACE_CARD_SM),
        emptyStateClass: escapeHtml(EMPTY_DASHED_CARD),
        linkClass: escapeHtml(`mt-1 inline-flex ${TEXT_LINK}`),
        days: days.map((day) => ({
          label: escapeHtml(day.label),
          slotCountText: escapeHtml(`${day.slots.length} open`),
          hasEvents: day.hasEvents,
          showNoEvents: !day.hasEvents,
          events: day.events.map((event) => ({
            summary: escapeHtml(event.summary),
            timeText: escapeHtml(event.timeText),
            descriptionVisible: Boolean(event.description),
            description: escapeHtml(event.description || ""),
            linkVisible: Boolean(event.htmlLink),
            htmlLink: escapeHtml(event.htmlLink || ""),
          })),
          hasSlots: day.hasSlots,
          showNoSlots: !day.hasSlots,
          slots: day.slots.map((slot) => ({
            href: escapeHtml(slot.href),
            label: escapeHtml(slot.label),
            slotClass: escapeHtml(
              `${slot.selected ? "bg-app-brand text-white hover:bg-app-brand-strong" : "border border-app-field bg-app-surface text-app-text hover:bg-app-surface-soft dark:border-app-field-dark dark:bg-app-surface-dark dark:text-app-text-dark dark:hover:bg-app-surface-soft-dark"} inline-flex rounded-control px-badge-pill-x py-badge-pill-y text-xs font-medium`,
            ),
            currentAttr: slot.selected ? "step" : null,
          })),
        })),
      },
    ),
  );

  const setupCard = renderCard(
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

  const syncFailureCard = renderCard(
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

  const selectedSlotCard =
    configured && sourceMode === "api" && !syncFailed && selectedSlotStart && selectedSlotEnd && selectedStudentId
      ? renderCard(
          renderView(
            `<h2 class="text-lg font-semibold">Schedule Selected Slot</h2>
            <p &class="(get props subtleText)" &children="(get props description)"></p>
            <form action="/actions/schedule-meeting" method="post" class="mt-panel-sm space-y-stack-xs">
              <input type="hidden" name="returnTo" &value="(get props returnTo)" />
              <input type="hidden" name="studentId" &value="(get props studentId)" />
              <input type="hidden" name="week" &value="(get props selectedWeek)" />
              <input type="hidden" name="slotStart" &value="(get props slotStart)" />
              <input type="hidden" name="slotEnd" &value="(get props slotEnd)" />
              <label &class="(get props formLabelClass)">
                <span>Google Calendar title</span>
                <input name="title" required="required" &class="(get props fieldClass)" &value="(get props defaultTitle)" />
              </label>
              <label &class="(get props formLabelClass)">
                <span>Invite email</span>
                <input
                  name="meetingEmail"
                  type="email"
                  inputmode="email"
                  required="required"
                  &class="(get props fieldClass)"
                  &value="(get props emailValue)"
                />
              </label>
              <label &class="(get props formLabelClass)">
                <span>Description (optional)</span>
                <textarea name="description" rows="4" &class="(get props fieldClass)" &children="(get props defaultDescription)"></textarea>
              </label>
              <noop &children="(get props submitButton)"></noop>
            </form>`,
            {
              subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
              description: escapeHtml(`Create a Google Calendar event for ${selectedStudentName || "the selected student"} at ${selectedSlotLabel}.`),
              returnTo: escapeHtml(selectedSlotHref || `/schedule?week=${selectedWeek}`),
              studentId: escapeHtml(selectedStudentId),
              selectedWeek: escapeHtml(selectedWeek),
              slotStart: escapeHtml(selectedSlotStart),
              slotEnd: escapeHtml(selectedSlotEnd),
              formLabelClass: escapeHtml(FORM_LABEL),
              fieldClass: escapeHtml(`mt-1 ${FIELD_CONTROL_SM}`),
              defaultTitle: escapeHtml(defaultTitle),
              emailValue: escapeHtml(selectedStudentEmail),
              defaultDescription: escapeHtml(defaultDescription),
              submitButton: renderButton({
                label: "Create Google Calendar event",
                type: "submit",
                variant: "primaryBlock",
              }),
            },
          ),
        )
      : renderCard(
          renderView(
            `<h2 class="text-lg font-semibold">Schedule Selected Slot</h2>
            <p &class="(get props subtleText)" &children="(get props message)"></p>`,
            {
              subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
              message: escapeHtml(
                configured && syncFailed
                  ? "Calendar availability is unavailable until Google Calendar sync starts working again."
                  : sourceMode === "ical"
                  ? "Google Calendar iCal fallback mode is read-only. Add full Google OAuth credentials in Data Tools to create invitations from the app."
                  : configured && selectedSlotStart && selectedSlotEnd
                  ? "Choose a student before creating a Google Calendar invitation for this slot."
                  : configured
                  ? "Choose an available slot from the week view to prepare a Google Calendar invitation."
                  : "Google Calendar must be configured before meetings can be scheduled.",
              ),
            },
          ),
        );

  const bodyContent = renderView(
    `<div &class="(get props pageWrap)">
      <noop &children="(get props headerHtml)"></noop>
      <noop &children="(get props flashHtml)"></noop>
      <noop &children="(get props controlsCard)"></noop>
      <noop &children="(get props mainCard)"></noop>
      <noop &children="(get props selectedSlotCard)"></noop>
    </div>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP),
      headerHtml: renderAuthedPageHeader(
        "Google Calendar Scheduling",
        "See existing Google Calendar events, find open slots, and send student meeting invitations.",
        `${renderButton({
          label: "Dashboard",
          href: "/",
          variant: "neutral",
        })}${renderButton({
          label: "Data tools",
          href: "/data-tools",
          variant: "neutral",
        })}${renderButton({
          label: "Add student",
          href: "/students/new",
          variant: "primary",
        })}${showStyleGuide ? renderButton({
          label: "Style guide",
          href: "/style-guide",
          variant: "neutral",
        }) : ""}`,
        viewer,
      ),
      flashHtml: renderFlashMessages(notice, error),
      controlsCard: scheduleControlsCard,
      mainCard: !configured ? setupCard : syncFailed ? syncFailureCard : calendarCard,
      selectedSlotCard,
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker - Schedule", bodyContent);
}
