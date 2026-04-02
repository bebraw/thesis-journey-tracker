import { raw } from "../../htmlisp";
import { FIELD_CONTROL_SM, FORM_LABEL, SUBTLE_TEXT, renderButton, renderCard } from "../../ui";
import type { SchedulePageData } from "../types";
import { renderView } from "../shared.htmlisp";

export function renderScheduleControlsCard(data: SchedulePageData): string {
  const { currentWeekHref, nextWeekHref, prevWeekHref, selectedStudentId, selectedStudentName, selectedWeek, sourceMode, students, timeZone } = data;

  return renderCard(
    renderView(
      `<div class="flex flex-col gap-stack-xs xl:flex-row xl:items-end xl:justify-between">
        <form action="/schedule" method="get" class="grid flex-1 grid-cols-1 gap-stack-xs sm:grid-cols-[minmax(0,20rem)_auto]">
          <label &class="formLabelClass">
            <span>Student</span>
            <select name="student" onchange="this.form.requestSubmit()" &class="fieldClass">
              <option value="">Choose a student</option>
              <fragment &foreach="studentOptions as option">
                <option &value="option.value" &selected="option.selectedAttr" &children="option.label"></option>
              </fragment>
            </select>
          </label>
          <input type="hidden" name="week" &value="selectedWeek" />
          <fragment &children="applyButton"></fragment>
        </form>
        <div class="flex flex-wrap items-center gap-stack-xs">
          <fragment &children="prevButton"></fragment>
          <fragment &children="currentButton"></fragment>
          <fragment &children="nextButton"></fragment>
        </div>
      </div>
      <p &class="subtleText" &children="helperText"></p>`,
      {
        formLabelClass: FORM_LABEL,
        fieldClass: `mt-1 ${FIELD_CONTROL_SM}`,
        selectedWeek,
        studentOptions: students.map((student) => ({
          value: student.value,
          label: student.label,
          selectedAttr: student.selected ? "selected" : null,
        })),
        applyButton: raw(renderButton({
          label: "Show schedule",
          type: "submit",
          variant: "primaryBlock",
          className: "sm:self-end sm:w-auto sm:px-panel-sm",
        })),
        prevButton: raw(renderButton({
          label: "Previous week",
          href: prevWeekHref,
          variant: "neutral",
        })),
        currentButton: raw(renderButton({
          label: "Current week",
          href: currentWeekHref,
          variant: "neutral",
        })),
        nextButton: raw(renderButton({
          label: "Next week",
          href: nextWeekHref,
          variant: "neutral",
        })),
        subtleText: `mt-stack-xs ${SUBTLE_TEXT}`,
        helperText:
          sourceMode === "ical"
            ? selectedStudentId
              ? `Viewing Google Calendar iCal availability for ${selectedStudentName || "the selected student"} in ${timeZone}. This fallback mode is read-only.`
              : `Viewing Google Calendar iCal availability in ${timeZone}. Choose a student to compare availability against your supervision list.`
            : selectedStudentId
              ? `Scheduling for ${selectedStudentName || "the selected student"} in ${timeZone}. Pick an open slot to prepare a Google Calendar invitation.`
              : `Viewing Google Calendar availability in ${timeZone}. Choose a student to update the week instantly, then pick an open slot.`,
      },
    ),
  );
}
