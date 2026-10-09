import {
  FIELD_CONTROL,
  FIELD_CONTROL_SM,
  FORM_LABEL,
  renderInputField,
  renderSelectField,
  renderTextareaField,
  type SelectOption,
} from "../../ui";
import { raw } from "../../htmlisp";
import type { DashboardLaneDefinition } from "../../dashboard-lanes";
import { DEGREE_TYPES, PHASES, STUDENT_FORM_FIELDS, type StudentFormValues } from "../../students";
import { renderView } from "../shared.htmlisp";
import { DATETIME_LOCAL_HALF_HOUR_STEP } from "./date-time";

export interface StudentFormFieldMap {
  nameField: string;
  emailField: string;
  degreeField: string;
  topicField: string;
  notesField: string;
  phaseField: string;
  startDateField: string;
  nextMeetingField: string;
}

interface RenderStudentFormFieldsOptions {
  values: StudentFormValues;
  dashboardLanes?: DashboardLaneDefinition[];
  controlSize?: "default" | "compact";
  emailLabel?: string;
  topicWrapperClassName?: string;
  notesWrapperClassName?: string;
}

export function renderStudentFormFields(options: RenderStudentFormFieldsOptions): StudentFormFieldMap {
  const {
    values,
    dashboardLanes = [],
    controlSize = "default",
    emailLabel = "Email",
    topicWrapperClassName,
    notesWrapperClassName,
  } = options;

  const controlClass = controlSize === "compact" ? FIELD_CONTROL_SM : FIELD_CONTROL;

  const degreeOptions: SelectOption[] = DEGREE_TYPES.map((degree) => ({
    label: degree.label,
    value: degree.id,
  }));
  const phaseOptions: SelectOption[] = PHASES.map((phase) => ({
    label: dashboardLanes.find((lane) => lane.phaseId === phase.id)?.label || phase.label,
    value: phase.id,
  }));
  const nextMeetingInput = renderInputField({
    label: controlSize === "compact" ? "Next meeting (optional)" : "Next meeting",
    name: STUDENT_FORM_FIELDS.nextMeetingAt,
    type: "datetime-local",
    value: values.nextMeetingAt,
    className: controlClass,
    attrs: DATETIME_LOCAL_HALF_HOUR_STEP,
  });
  const clearNextMeetingHint = values.nextMeetingAt
    ? renderView(
        `<label class="mt-2 flex items-start gap-badge-x text-xs leading-5 text-app-text-muted dark:text-app-text-muted-dark">
          <input
            type="checkbox"
            &name="fieldName"
            value="yes"
            class="mt-0.5 h-4 w-4 rounded-sm border-app-field text-app-brand focus:ring-app-brand dark:border-app-field-dark"
          />
          <span>Clear next meeting</span>
        </label>`,
        {
          fieldName: STUDENT_FORM_FIELDS.clearNextMeetingAt,
        },
      )
    : "";
  const repeatFields =
    renderSelectField({
      label: "Repeat meeting",
      name: "repeatWeeks",
      value: values.repeatWeeks || "0",
      options: [
        { label: "Does not repeat", value: "0" },
        ...[1, 2, 3, 4].map((weeks) => ({ label: weeks === 1 ? "Every week" : `Every ${weeks} weeks`, value: String(weeks) })),
        ...(!["0", "1", "2", "3", "4"].includes(values.repeatWeeks || "0")
          ? [{ label: `Every ${values.repeatWeeks} weeks`, value: values.repeatWeeks! }]
          : []),
      ],
      className: controlClass,
    }) +
    renderInputField({
      label: "Meeting timezone",
      name: "meetingTimeZone",
      value: values.meetingTimeZone || "Europe/Helsinki",
      className: controlClass,
    }) +
    renderInputField({
      label: "Repeat until (optional)",
      name: "repeatUntil",
      type: "date",
      value: values.repeatUntil || "",
      className: controlClass,
    });

  return {
    nameField: renderInputField({
      label: "Name",
      name: STUDENT_FORM_FIELDS.name,
      required: true,
      value: values.name,
      className: controlClass,
    }),
    emailField: renderInputField({
      label: emailLabel,
      name: STUDENT_FORM_FIELDS.email,
      value: values.email,
      className: controlClass,
      attrs: {
        type: "text",
        inputmode: "email",
        autocomplete: "off",
        autocapitalize: "off",
        spellcheck: "false",
        "data-bwignore": "true",
        "data-lpignore": "true",
        "data-1p-ignore": "true",
      },
    }),
    degreeField: renderSelectField({
      label: "Degree type",
      name: STUDENT_FORM_FIELDS.degreeType,
      options: degreeOptions,
      value: values.degreeType,
      className: controlClass,
    }),
    topicField: renderInputField({
      label: "Thesis topic (optional)",
      name: STUDENT_FORM_FIELDS.thesisTopic,
      value: values.thesisTopic,
      className: controlClass,
      wrapperClassName: topicWrapperClassName || FORM_LABEL,
    }),
    notesField: renderTextareaField({
      label: "Student notes (optional)",
      name: STUDENT_FORM_FIELDS.studentNotes,
      value: values.studentNotes,
      rows: controlSize === "compact" ? 4 : 5,
      className: controlClass,
      wrapperClassName: notesWrapperClassName || FORM_LABEL,
    }),
    phaseField: renderSelectField({
      label: "Phase",
      name: STUDENT_FORM_FIELDS.currentPhase,
      options: phaseOptions,
      value: values.currentPhase,
      className: controlClass,
    }),
    startDateField: renderInputField({
      label: "Start date (optional)",
      name: STUDENT_FORM_FIELDS.startDate,
      type: "date",
      value: values.startDate,
      className: controlClass,
    }),
    nextMeetingField: renderView(
      `<div class="block min-w-0 space-y-3 text-sm">
        <fragment &children="inputHtml"></fragment>
        <fragment &children="hintHtml"></fragment>
        <fragment &children="repeatHtml"></fragment>
      </div>`,
      {
        inputHtml: raw(nextMeetingInput),
        hintHtml: raw(clearNextMeetingHint),
        repeatHtml: raw(repeatFields),
      },
    ),
  };
}
