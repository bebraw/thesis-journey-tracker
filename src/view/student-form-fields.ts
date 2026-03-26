import { FIELD_CONTROL, FIELD_CONTROL_SM, FORM_LABEL, renderInputField, renderSelectField, renderTextareaField, type SelectOption } from "../ui";
import { STUDENT_FORM_FIELDS, type StudentFormValues } from "../student-form";
import { DEGREE_TYPES, PHASES } from "../reference-data";

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
  controlSize?: "default" | "compact";
  emailLabel?: string;
  topicWrapperClassName?: string;
  notesWrapperClassName?: string;
}

export function renderStudentFormFields(options: RenderStudentFormFieldsOptions): StudentFormFieldMap {
  const {
    values,
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
    nextMeetingField: renderInputField({
      label: controlSize === "compact" ? "Next meeting (optional)" : "Next meeting",
      name: STUDENT_FORM_FIELDS.nextMeetingAt,
      type: "datetime-local",
      value: values.nextMeetingAt,
      className: controlClass,
      attributes: 'step="3600"',
    }),
  };
}
