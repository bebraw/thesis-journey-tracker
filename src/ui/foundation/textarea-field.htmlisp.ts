import { mergeHtmlispAttributeMaps, renderEscapedHTMLisp } from "../../htmlisp";
import { renderFieldShell } from "./field-shell.htmlisp";
import { FIELD_CONTROL, FORM_LABEL } from "../styles";
import type { TextareaFieldOptions } from "../types";

export function renderTextareaField(options: TextareaFieldOptions): string {
  const {
    label,
    name,
    id,
    value,
    rows = 3,
    className = FIELD_CONTROL,
    wrapperClassName = FORM_LABEL,
    required = false,
    attrs,
  } = options;

  const attributesMap = mergeHtmlispAttributeMaps(
    attrs,
    {
      name,
      id,
      rows: String(rows),
      class: className,
      required,
    },
  );

  const controlHtml = renderEscapedHTMLisp(
    `<textarea
        &attrs="attributesMap"
        &children="value"
      ></textarea>`,
    { attributesMap, value: value || "" },
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
}
