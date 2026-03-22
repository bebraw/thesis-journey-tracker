import { escapeHtml } from "../utils";
import {
  buildHtmlispAttributes,
  omitHtmlispAttributes,
  parseHtmlispAttributes,
  renderHTMLisp,
  serializeHtmlispAttributes,
} from "../htmlisp";
import { escapeOptional, fillTemplate } from "./helpers";
import { renderFieldShell } from "./field-shell.htmlisp";
import { FIELD_CONTROL, FORM_LABEL } from "./styles";
import type { SelectFieldOptions } from "./types";

interface RenderableSelectOption {
  label: string;
  optionValue: string;
  selectedAttr?: string;
}

export function renderSelectField(options: SelectFieldOptions): string {
  const { label, name, id, options: selectOptions, value, className = FIELD_CONTROL, wrapperClassName = FORM_LABEL, attributes } = options;

  const parsedAttributes = parseHtmlispAttributes(attributes);
  const extraAttributes = omitHtmlispAttributes(parsedAttributes, ["name", "id", "class"]);
  const normalizedOptions: RenderableSelectOption[] = selectOptions.map((option) => ({
    label: escapeHtml(option.label),
    optionValue: escapeHtml(option.value),
    selectedAttr: option.value === value ? "selected" : undefined,
  }));
  const baseAttributes = serializeHtmlispAttributes(
    buildHtmlispAttributes([
      { name: "name", value: escapeOptional(name) },
      { name: "id", value: escapeOptional(id) },
      { name: "class", value: escapeHtml(className) },
    ]),
  );

  const controlHtml = renderHTMLisp(
    fillTemplate(
      `<select__BASE_ATTRIBUTES____EXTRA_ATTRIBUTES__>
        <noop &foreach="(get props options)">
          <option
            &value="(get props optionValue)"
            &selected="(get props selectedAttr)"
            &children="(get props label)"
          ></option>
        </noop>
      </select>`,
      {
        __BASE_ATTRIBUTES__: baseAttributes,
        __EXTRA_ATTRIBUTES__: serializeHtmlispAttributes(extraAttributes),
      },
    ),
    { options: normalizedOptions },
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
}
