import {
  FIELD_CONTROL_SM,
  FORM_LABEL,
  PAGE_WRAP_NARROW,
  SUBTLE_TEXT,
  renderButton,
  renderCard,
  renderInputField,
  renderSelectField,
  type SelectOption,
} from "../components";
import { escapeHtml } from "../utils";
import {
  THEME_TOGGLE_SCRIPT,
  renderAuthedPageHeader,
  renderDocument,
  renderFlashMessages,
  renderView,
} from "./shared";
import { DEGREE_TYPES, PHASES, type AddStudentPageData } from "./types";

export function renderAddStudentPage(data: AddStudentPageData): string {
  const { notice, error } = data;
  const degreeOptions: SelectOption[] = DEGREE_TYPES.map((degree) => ({
    label: degree.label,
    value: degree.id,
  }));
  const phaseOptions: SelectOption[] = PHASES.map((phase) => ({
    label: phase.label,
    value: phase.id,
  }));

  const formHtml = renderView(
    `<form action="/actions/add-student" method="post" class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <noop &children="(get props nameField)"></noop>
      <noop &children="(get props emailField)"></noop>
      <noop &children="(get props degreeField)"></noop>
      <noop &children="(get props topicField)"></noop>
      <noop &children="(get props phaseField)"></noop>
      <noop &children="(get props startDateField)"></noop>
      <noop &children="(get props targetDateField)"></noop>
      <noop &children="(get props nextMeetingField)"></noop>
      <noop &children="(get props submitButton)"></noop>
    </form>`,
    {
      nameField: renderInputField({
        label: "Name",
        name: "name",
        required: true,
        className: FIELD_CONTROL_SM,
      }),
      emailField: renderInputField({
        label: "Email (optional)",
        name: "studentEmail",
        className: FIELD_CONTROL_SM,
        attributes:
          'type="text" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" data-bwignore="true" data-lpignore="true" data-1p-ignore="true"',
      }),
      degreeField: renderSelectField({
        label: "Degree type",
        name: "degreeType",
        options: degreeOptions,
        value: "msc",
        className: FIELD_CONTROL_SM,
      }),
      topicField: renderInputField({
        label: "Thesis topic (optional)",
        name: "thesisTopic",
        className: FIELD_CONTROL_SM,
        wrapperClassName: `${FORM_LABEL} sm:col-span-2 lg:col-span-3`,
      }),
      phaseField: renderSelectField({
        label: "Phase",
        name: "currentPhase",
        options: phaseOptions,
        className: FIELD_CONTROL_SM,
      }),
      startDateField: renderInputField({
        label: "Start date",
        name: "startDate",
        type: "date",
        required: true,
        className: FIELD_CONTROL_SM,
      }),
      targetDateField: renderInputField({
        label: "Target submission (optional)",
        name: "targetSubmissionDate",
        type: "date",
        className: FIELD_CONTROL_SM,
      }),
      nextMeetingField: renderInputField({
        label: "Next meeting (optional)",
        name: "nextMeetingAt",
        type: "datetime-local",
        className: FIELD_CONTROL_SM,
      }),
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
          label: "Style guide",
          href: "/style-guide",
          variant: "neutral",
        })}`,
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
              "Target submission defaults to six months from start date when left empty.",
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
