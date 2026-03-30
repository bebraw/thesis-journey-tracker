import { escapeHtml } from "../../formatting";
import { getDefaultStudentFormValues } from "../../students";
import { PAGE_WRAP_NARROW, SUBTLE_TEXT, renderButton, renderCard } from "../../ui";
import type { AddStudentPageData } from "../types";
import { THEME_TOGGLE_SCRIPT, renderAuthedPageHeader, renderDocument, renderFlashMessages, renderView } from "../shared.htmlisp";
import { renderStudentFormFields } from "./form-fields";

export function renderAddStudentPage(data: AddStudentPageData): string {
  const { viewer, notice, error, showStyleGuide } = data;
  const fields = renderStudentFormFields({
    values: getDefaultStudentFormValues(),
    controlSize: "compact",
    emailLabel: "Email (optional)",
    topicWrapperClassName: "block text-sm sm:col-span-2 lg:col-span-3",
    notesWrapperClassName: "block text-sm sm:col-span-2 lg:col-span-3",
  });

  const formHtml = renderView(
    `<form action="/actions/add-student" method="post" class="mt-panel-sm grid grid-cols-1 gap-stack-xs sm:grid-cols-2 lg:grid-cols-3">
      <noop &children="(get props nameField)"></noop>
      <noop &children="(get props emailField)"></noop>
      <noop &children="(get props degreeField)"></noop>
      <noop &children="(get props topicField)"></noop>
      <noop &children="(get props notesField)"></noop>
      <noop &children="(get props phaseField)"></noop>
      <noop &children="(get props startDateField)"></noop>
      <noop &children="(get props nextMeetingField)"></noop>
      <noop &children="(get props submitButton)"></noop>
    </form>`,
    {
      ...fields,
      submitButton: renderButton({
        label: "Add student",
        type: "submit",
        variant: "primaryBlock",
        className: "sm:col-span-2 lg:col-span-3",
      }),
    },
  );

  const bodyContent = renderView(
    `<div &class="(get props pageWrap)">
      <noop &children="(get props headerHtml)"></noop>
      <noop &children="(get props flashHtml)"></noop>
      <noop &children="(get props cardHtml)"></noop>
    </div>
    <noop &children="(get props themeToggleScript)"></noop>`,
    {
      pageWrap: escapeHtml(PAGE_WRAP_NARROW),
      headerHtml: renderAuthedPageHeader(
        "Add Student",
        "Create a new thesis supervision entry.",
        `${renderButton({
          label: "Dashboard",
          href: "/",
          variant: "neutral",
        })}${renderButton({
          label: "Schedule",
          href: "/schedule",
          variant: "neutral",
        })}${renderButton({
          label: "Data tools",
          href: "/data-tools",
          variant: "neutral",
        })}${showStyleGuide ? renderButton({
          label: "Style guide",
          href: "/style-guide",
          variant: "neutral",
        }) : ""}`,
        viewer,
      ),
      flashHtml: renderFlashMessages(notice, error),
      cardHtml: renderCard(
        renderView(
          `<h2 class="text-lg font-semibold">Student Details</h2>
          <p &class="(get props subtleText)" &children="(get props description)"></p>
          <noop &children="(get props formHtml)"></noop>`,
          {
            subtleText: escapeHtml(`mt-1 ${SUBTLE_TEXT}`),
            description: escapeHtml(
              "For MSc students, target submission is calculated automatically as six months from the start date. If start date is blank, no target date is shown until one is set.",
            ),
            formHtml,
          },
        ),
      ),
      themeToggleScript: THEME_TOGGLE_SCRIPT,
    },
  );

  return renderDocument("Thesis Journey Tracker - Add Student", bodyContent);
}
