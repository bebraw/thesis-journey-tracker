import { escapeHtml } from "../utils";
import {
  buildHtmlispAttributes,
  getHtmlispAttributeValue,
  hasHtmlispBooleanAttribute,
  omitHtmlispAttributes,
  parseHtmlispAttributes,
  renderHTMLisp,
  serializeHtmlispAttributes,
} from "../htmlisp";
import { escapeOptional, fillTemplate } from "./helpers";
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
  const extraAttributes = omitHtmlispAttributes(parsedAttributes, ["type", "name", "id", "value", "placeholder", "required", "class"]);
  const baseAttributes = serializeHtmlispAttributes(
    buildHtmlispAttributes([
      { name: "name", value: escapeOptional(name) },
      { name: "id", value: escapeOptional(id) },
      { name: "type", value: escapeHtml(resolvedType) },
      { name: "value", value: escapeOptional(value) },
      { name: "placeholder", value: escapeOptional(placeholder) },
      { name: "class", value: escapeHtml(className) },
      { name: "required", value: resolvedRequired ? true : undefined },
    ]),
  );

  const controlHtml = renderHTMLisp(
    fillTemplate("<input__BASE_ATTRIBUTES____EXTRA_ATTRIBUTES__ />", {
      __BASE_ATTRIBUTES__: baseAttributes,
      __EXTRA_ATTRIBUTES__: serializeHtmlispAttributes(extraAttributes),
    }),
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
}
