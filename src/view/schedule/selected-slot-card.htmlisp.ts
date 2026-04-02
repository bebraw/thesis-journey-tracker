import { raw } from "../../htmlisp";
import { FIELD_CONTROL_SM, SUBTLE_TEXT, renderButton, renderCard, renderInputField, renderTextareaField } from "../../ui";
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

  const titleFieldHtml = renderInputField({
    label: "Google Calendar title",
    name: "title",
    required: true,
    value: defaultTitle,
    className: FIELD_CONTROL_SM,
  });
  const emailFieldHtml = renderInputField({
    label: "Invite email",
    name: "meetingEmail",
    type: "email",
    required: true,
    value: selectedStudentEmail,
    className: FIELD_CONTROL_SM,
    attrs: {
      inputmode: "email",
    },
  });
  const descriptionFieldHtml = renderTextareaField({
    label: "Description (optional)",
    name: "description",
    rows: 4,
    value: defaultDescription,
    className: FIELD_CONTROL_SM,
  });

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
            <fragment &children="titleFieldHtml"></fragment>
            <fragment &children="emailFieldHtml"></fragment>
            <fragment &children="descriptionFieldHtml"></fragment>
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
            titleFieldHtml: raw(titleFieldHtml),
            emailFieldHtml: raw(emailFieldHtml),
            descriptionFieldHtml: raw(descriptionFieldHtml),
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
