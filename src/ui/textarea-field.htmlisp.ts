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
import type { TextareaFieldOptions } from "./types";

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
    attributes,
  } = options;

  const parsedAttributes = parseHtmlispAttributes(attributes);
  const resolvedRequired = required || hasHtmlispBooleanAttribute(parsedAttributes, "required");
  const resolvedRows = getHtmlispAttributeValue(parsedAttributes, "rows") ?? String(rows);
  const extraAttributes = htmlispAttributesToMap(omitHtmlispAttributes(parsedAttributes, ["name", "id", "rows", "required", "class"]));
  const baseAttributes = buildHtmlispAttributeMap([
    { name: "name", value: name },
    { name: "id", value: id },
    { name: "rows", value: resolvedRows },
    { name: "class", value: className },
    { name: "required", value: resolvedRequired },
  ]);
  const attributesMap = { ...extraAttributes, ...baseAttributes };

  const controlHtml = renderHTMLisp(
    `<textarea
        &attrs="attributesMap"
        &children="value"
      ></textarea>`,
    { attributesMap, value: value || "" },
    undefined,
    { escapeByDefault: true },
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
}
