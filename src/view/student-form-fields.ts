import {
  FIELD_CONTROL,
  FIELD_CONTROL_SM,
  FORM_LABEL,
  renderInputField,
  renderSelectField,
  type SelectOption,
} from "../ui";
import { STUDENT_FORM_FIELDS, type StudentFormValues } from "../student-form";
import { DEGREE_TYPES, PHASES } from "../reference-data";

export interface StudentFormFieldMap {
  nameField: string;
  emailField: string;
  degreeField: string;
  topicField: string;
  phaseField: string;
  startDateField: string;
  targetDateField: string;
  nextMeetingField: string;
}

interface RenderStudentFormFieldsOptions {
  values: StudentFormValues;
  controlSize?: "default" | "compact";
  emailLabel?: string;
  targetSubmissionLabel?: string;
  topicWrapperClassName?: string;
}

export function renderStudentFormFields(
  options: RenderStudentFormFieldsOptions,
): StudentFormFieldMap {
  const {
    values,
    controlSize = "default",
    emailLabel = "Email",
    targetSubmissionLabel = "Target submission date",
    topicWrapperClassName,
  } = options;

  const controlClass =
    controlSize === "compact" ? FIELD_CONTROL_SM : FIELD_CONTROL;

  const degreeOptions: SelectOption[] = DEGREE_TYPES.map((degree) => ({
    label: degree.label,
    value: degree.id,
  }));
  const phaseOptions: SelectOption[] = PHASES.map((phase) => ({
    label: phase.label,
    value: phase.id,
  }));

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
      attributes:
        'type="text" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" data-bwignore="true" data-lpignore="true" data-1p-ignore="true"',
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
    phaseField: renderSelectField({
      label: "Phase",
      name: STUDENT_FORM_FIELDS.currentPhase,
      options: phaseOptions,
      value: values.currentPhase,
      className: controlClass,
    }),
    startDateField: renderInputField({
      label: "Start date",
      name: STUDENT_FORM_FIELDS.startDate,
      type: "date",
      required: true,
      value: values.startDate,
      className: controlClass,
    }),
    targetDateField: renderInputField({
      label: targetSubmissionLabel,
      name: STUDENT_FORM_FIELDS.targetSubmissionDate,
      type: "date",
      value: values.targetSubmissionDate,
      className: controlClass,
      attributes: controlSize === "compact" ? undefined : "required",
      required: controlSize !== "compact",
    }),
    nextMeetingField: renderInputField({
      label:
        controlSize === "compact" ? "Next meeting (optional)" : "Next meeting",
      name: STUDENT_FORM_FIELDS.nextMeetingAt,
      type: "datetime-local",
      value: values.nextMeetingAt,
      className: controlClass,
    }),
  };
}
