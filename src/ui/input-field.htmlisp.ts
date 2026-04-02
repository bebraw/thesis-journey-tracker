import {
  buildHtmlispAttributeMap,
  getHtmlispAttributeValue,
  hasHtmlispBooleanAttribute,
  htmlispAttributesToMap,
  omitHtmlispAttributes,
  parseHtmlispAttributes,
  renderHTMLisp,
} from "../htmlisp";
import { renderFieldShell } from "./field-shell.htmlisp";
import { FIELD_CONTROL, FORM_LABEL } from "./styles";
import type { FieldOptions } from "./types";

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
    attributes,
  } = options;

  const parsedAttributes = parseHtmlispAttributes(attributes);
  const resolvedType = getHtmlispAttributeValue(parsedAttributes, "type") ?? type;
  const resolvedRequired = required || hasHtmlispBooleanAttribute(parsedAttributes, "required");
  const extraAttributes = htmlispAttributesToMap(omitHtmlispAttributes(parsedAttributes, ["type", "name", "id", "value", "placeholder", "required", "class"]));
  const baseAttributes = buildHtmlispAttributeMap([
    { name: "name", value: name },
    { name: "id", value: id },
    { name: "type", value: resolvedType },
    { name: "value", value },
    { name: "placeholder", value: placeholder },
    { name: "class", value: className },
    { name: "required", value: resolvedRequired },
  ]);
  const attributesMap = { ...extraAttributes, ...baseAttributes };

  const controlHtml = renderHTMLisp(
    "<input &attrs=\"attributesMap\" />",
    { attributesMap },
    undefined,
    { escapeByDefault: true },
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
}
