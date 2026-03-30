import { escapeHtml } from "../formatting";
import { renderHTMLisp } from "../htmlisp";
import { FIELD_LABEL, FORM_LABEL } from "./styles";

export function renderFieldShell(label: string, controlHtml: string, wrapperClassName = FORM_LABEL): string {
  return renderHTMLisp(
    `<label &class="(get props wrapperClassName)">
      <span &class="(get props labelClassName)" &children="(get props label)"></span>
      <noop &children="(get props controlHtml)"></noop>
    </label>`,
    {
      labelClassName: escapeHtml(FIELD_LABEL),
      label: escapeHtml(label),
      controlHtml,
      wrapperClassName: escapeHtml(wrapperClassName),
    },
  );
}
