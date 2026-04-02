import { raw, renderEscapedHTMLisp } from "../../htmlisp";
import type { UIExampleSection } from "../examples";
import { FIELD_CONTROL_SM, FORM_LABEL } from "../styles";
import { renderInputField } from "./input-field.htmlisp";
import { renderSelectField } from "./select-field.htmlisp";
import { renderTextareaField } from "./textarea-field.htmlisp";

export function getFieldExamplesSection(): UIExampleSection {
  return {
    id: "form-fields",
    scope: "foundation",
    title: "Form Fields",
    description:
      "Inputs, selects, and textareas are rendered from small wrapper functions so labels and spacing stay aligned.",
    whenToUse: "Use the field helpers for normal editable forms so labels, spacing, and control density stay consistent.",
    avoidFor: "Avoid custom one-off label and input wrappers unless the control is not a standard input/select/textarea.",
    contentHtml: renderEscapedHTMLisp(
      `<form class="mt-panel-sm grid grid-cols-1 gap-stack-xs sm:grid-cols-2">
        <fragment &children="studentNameField"></fragment>
        <fragment &children="degreeField"></fragment>
        <fragment &children="topicField"></fragment>
        <fragment &children="notesField"></fragment>
      </form>`,
      {
        studentNameField: raw(renderInputField({
          label: "Student name",
          value: "Ada Lovelace",
          className: FIELD_CONTROL_SM,
        })),
        degreeField: raw(renderSelectField({
          label: "Degree type",
          options: [
            { label: "BSc", value: "bsc" },
            { label: "MSc", value: "msc" },
            { label: "Doctoral", value: "doctoral" },
          ],
          value: "msc",
          className: FIELD_CONTROL_SM,
        })),
        topicField: raw(renderInputField({
          label: "Thesis topic",
          value: "Supervision dashboard usability",
          className: FIELD_CONTROL_SM,
          wrapperClassName: `${FORM_LABEL} sm:col-span-2`,
        })),
        notesField: raw(renderTextareaField({
          label: "Advisor notes",
          value: "This textarea uses the same label and border patterns as the forms in the app.",
          className: FIELD_CONTROL_SM,
          wrapperClassName: `${FORM_LABEL} sm:col-span-2`,
        })),
      },
    ),
  };
}
