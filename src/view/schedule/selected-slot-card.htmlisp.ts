import { raw } from "../../htmlisp";
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
          <p &class="subtleText" &children="description"></p>
          <form action="/actions/schedule-meeting" method="post" class="mt-panel-sm space-y-stack-xs">
            <input type="hidden" name="returnTo" &value="returnTo" />
            <input type="hidden" name="studentId" &value="studentId" />
            <input type="hidden" name="week" &value="selectedWeek" />
            <input type="hidden" name="slotStart" &value="slotStart" />
            <input type="hidden" name="slotEnd" &value="slotEnd" />
            <label &class="formLabelClass">
              <span>Google Calendar title</span>
              <input name="title" required="required" &class="fieldClass" &value="defaultTitle" />
            </label>
            <label &class="formLabelClass">
              <span>Invite email</span>
              <input
                name="meetingEmail"
                type="email"
                inputmode="email"
                required="required"
                &class="fieldClass"
                &value="emailValue"
              />
            </label>
            <label &class="formLabelClass">
              <span>Description (optional)</span>
              <textarea name="description" rows="4" &class="fieldClass" &children="defaultDescription"></textarea>
            </label>
            <fragment &children="submitButton"></fragment>
          </form>`,
          {
            subtleText: `mt-1 ${SUBTLE_TEXT}`,
            description: `Create a Google Calendar event for ${selectedStudentName || "the selected student"} at ${selectedSlotLabel}.`,
            returnTo: selectedSlotHref || `/schedule?week=${selectedWeek}`,
            studentId: selectedStudentId,
            selectedWeek,
            slotStart: selectedSlotStart,
            slotEnd: selectedSlotEnd,
            formLabelClass: FORM_LABEL,
            fieldClass: `mt-1 ${FIELD_CONTROL_SM}`,
            defaultTitle,
            emailValue: selectedStudentEmail,
            defaultDescription,
            submitButton: raw(renderButton({
              label: "Create Google Calendar event",
              type: "submit",
              variant: "primaryBlock",
            })),
          },
        ),
      )
    : renderCard(
        renderView(
          `<h2 class="text-lg font-semibold">Schedule Selected Slot</h2>
          <p &class="subtleText" &children="message"></p>`,
          {
            subtleText: `mt-1 ${SUBTLE_TEXT}`,
            message:
              configured && syncFailed
                ? "Calendar availability is unavailable until Google Calendar sync starts working again."
                : sourceMode === "ical"
                  ? "Google Calendar iCal fallback mode is read-only. Add full Google OAuth credentials in Data Tools to create invitations from the app."
                  : configured && selectedSlotStart && selectedSlotEnd
                    ? "Choose a student before creating a Google Calendar invitation for this slot."
                    : configured
                      ? "Choose an available slot from the week view to prepare a Google Calendar invitation."
                      : "Google Calendar must be configured before meetings can be scheduled.",
          },
        ),
      );
}
