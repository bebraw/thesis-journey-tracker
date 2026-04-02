import {
  buildHtmlispAttributeMap,
  htmlispAttributesToMap,
  omitHtmlispAttributes,
  parseHtmlispAttributes,
  renderHTMLisp,
} from "../htmlisp";
import { renderFieldShell } from "./field-shell.htmlisp";
import { FIELD_CONTROL, FORM_LABEL } from "./styles";
import type { SelectFieldOptions } from "./types";

interface RenderableSelectOption {
  label: string;
  optionValue: string;
  selected?: boolean;
}

export function renderSelectField(options: SelectFieldOptions): string {
  const { label, name, id, options: selectOptions, value, className = FIELD_CONTROL, wrapperClassName = FORM_LABEL, attributes } = options;

  const parsedAttributes = parseHtmlispAttributes(attributes);
  const extraAttributes = htmlispAttributesToMap(omitHtmlispAttributes(parsedAttributes, ["name", "id", "class"]));
  const normalizedOptions: RenderableSelectOption[] = selectOptions.map((option) => ({
    label: option.label,
    optionValue: option.value,
    selected: option.value === value,
  }));
  const baseAttributes = buildHtmlispAttributeMap([
    { name: "name", value: name },
    { name: "id", value: id },
    { name: "class", value: className },
  ]);
  const attributesMap = { ...extraAttributes, ...baseAttributes };

  const controlHtml = renderHTMLisp(
    `<select &attrs="attributesMap">
        <fragment &foreach="options as option">
          <option
            &value="option.optionValue"
            &selected="option.selected"
            &children="option.label"
          ></option>
        </fragment>
      </select>`,
    { attributesMap, options: normalizedOptions },
    undefined,
    { escapeByDefault: true },
  );

  return renderFieldShell(label, controlHtml, wrapperClassName);
}
