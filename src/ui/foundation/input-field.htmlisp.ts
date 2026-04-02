import { mergeHtmlispAttributeMaps, renderEscapedHTMLisp } from "../../htmlisp";
import { renderFieldShell } from "./field-shell.htmlisp";
import { FIELD_CONTROL, FORM_LABEL } from "../styles";
import type { FieldOptions } from "./field.types";

export function renderInputField(options: FieldOptions): string {
  const {
    label,
    name,
    id,
    type = "text",
    value,
    required = false,
    placeholder,
    className = FIELD_CONTROL,
    wrapperClassName = FORM_LABEL,
    attrs,
  } = options;

  const attributesMap = mergeHtmlispAttributeMaps(
    attrs,
    {
      name,
      id,
      type,
      value,
      placeholder,
      class: className,
      required,
    },
  );

  const controlHtml = renderEscapedHTMLisp(
    "<input &attrs=\"attributesMap\" />",
    { attributesMap },
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
}
