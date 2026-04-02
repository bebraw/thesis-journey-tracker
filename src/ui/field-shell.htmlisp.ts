import { raw, renderEscapedHTMLisp } from "../htmlisp";
import { FIELD_LABEL, FORM_LABEL } from "./styles";

export function renderFieldShell(label: string, controlHtml: string, wrapperClassName = FORM_LABEL): string {
  return renderEscapedHTMLisp(
    `<label &class="wrapperClassName">
      <span &class="labelClassName" &children="label"></span>
      <fragment &children="controlHtml"></fragment>
    </label>`,
    {
      labelClassName: FIELD_LABEL,
      label,
      controlHtml: raw(controlHtml),
      wrapperClassName,
    },
  );
}
