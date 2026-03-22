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
import { renderFieldShell } from "./field-shell";
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
  const resolvedRequired =
    required || hasHtmlispBooleanAttribute(parsedAttributes, "required");
  const resolvedRows =
    getHtmlispAttributeValue(parsedAttributes, "rows") ?? String(rows);
  const extraAttributes = omitHtmlispAttributes(parsedAttributes, [
    "name",
    "id",
    "rows",
    "required",
    "class",
  ]);
  const baseAttributes = serializeHtmlispAttributes(
    buildHtmlispAttributes([
      { name: "name", value: escapeOptional(name) },
      { name: "id", value: escapeOptional(id) },
      { name: "rows", value: escapeHtml(resolvedRows) },
      { name: "class", value: escapeHtml(className) },
      { name: "required", value: resolvedRequired ? true : undefined },
    ]),
  );

  const controlHtml = renderHTMLisp(
    fillTemplate(
      '<textarea__BASE_ATTRIBUTES____EXTRA_ATTRIBUTES__ &children="(get props value)"></textarea>',
      {
        __BASE_ATTRIBUTES__: baseAttributes,
        __EXTRA_ATTRIBUTES__: serializeHtmlispAttributes(extraAttributes),
      },
    ),
    { value: escapeHtml(value || "") },
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
}
