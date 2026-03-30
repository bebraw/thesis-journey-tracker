import { escapeHtml } from "../../formatting";
import { FIELD_CONTROL_SM, FORM_LABEL, SUBTLE_TEXT, renderButton, renderCard } from "../../ui";
import type { SchedulePageData } from "../types";
import { renderView } from "../shared.htmlisp";

export function renderScheduleControlsCard(data: SchedulePageData): string {
  const { currentWeekHref, nextWeekHref, prevWeekHref, selectedStudentId, selectedStudentName, selectedWeek, sourceMode, students, timeZone } = data;

  return renderCard(
    renderView(
      `<div class="flex flex-col gap-stack-xs xl:flex-row xl:items-end xl:justify-between">
        <form action="/schedule" method="get" class="grid flex-1 grid-cols-1 gap-stack-xs sm:grid-cols-[minmax(0,20rem)_auto]">
          <label &class="(get props formLabelClass)">
            <span>Student</span>
            <select name="student" onchange="this.form.requestSubmit()" &class="(get props fieldClass)">
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
              : `Viewing Google Calendar availability in ${timeZone}. Choose a student to update the week instantly, then pick an open slot.`,
        ),
      },
    ),
  );
}
