import { raw } from "../../htmlisp";
import { getDefaultStudentFormValues } from "../../students";
import { PAGE_WRAP_NARROW, SUBTLE_TEXT, renderButton, renderCard } from "../../ui";
import type { AddStudentPageData } from "../types";
import {
  renderAuthedPageDocument,
  renderView,
} from "../shared.htmlisp";
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
      <fragment &children="nameField"></fragment>
      <fragment &children="emailField"></fragment>
      <fragment &children="degreeField"></fragment>
      <fragment &children="topicField"></fragment>
      <fragment &children="notesField"></fragment>
      <fragment &children="phaseField"></fragment>
      <fragment &children="startDateField"></fragment>
      <fragment &children="nextMeetingField"></fragment>
      <fragment &children="submitButton"></fragment>
    </form>`,
    {
      ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, raw(value)])),
      submitButton: raw(renderButton({
        label: "Add student",
        type: "submit",
        variant: "primaryBlock",
        className: "sm:col-span-2 lg:col-span-3",
      })),
    },
  );

  return renderAuthedPageDocument({
    documentTitle: "Thesis Journey Tracker - Add Student",
    headerTitle: "Add Student",
    headerDescription: "Create a new thesis supervision entry.",
    currentPage: "add-student",
    viewer,
    pageWrapClass: PAGE_WRAP_NARROW,
    notice,
    error,
    showStyleGuide,
    sections: [
      renderCard(
        renderView(
          `<h2 class="text-lg font-semibold">Student Details</h2>
          <p &class="subtleText" &children="description"></p>
          <fragment &children="formHtml"></fragment>`,
          {
            subtleText: `mt-1 ${SUBTLE_TEXT}`,
            description:
              "For MSc students, target submission is calculated automatically as six months from the start date. If start date is blank, no target date is shown until one is set.",
            formHtml: raw(formHtml),
          },
        ),
      ),
    ],
  });
}
