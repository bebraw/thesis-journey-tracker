import { escapeHtml } from "../../formatting";
import { FIELD_CONTROL_SM, FORM_LABEL, SUBTLE_TEXT, renderButton, renderCard } from "../../ui";
import type { SchedulePageData } from "../types";
import { renderView } from "../shared.htmlisp";

export function renderSelectedSlotCard(data: SchedulePageData): string {
  const {
    configured,
    defaultDescription,
    defaultTitle,
    selectedSlotEnd,
    selectedSlotHref,
    selectedSlotLabel,
    selectedSlotStart,
    selectedStudentEmail,
    selectedStudentId,
    selectedStudentName,
    selectedWeek,
    sourceMode,
    syncFailed,
  } = data;

  return configured && sourceMode === "api" && !syncFailed && selectedSlotStart && selectedSlotEnd && selectedStudentId
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
}
