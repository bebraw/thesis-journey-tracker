import { htmlispAttributesToMap, parseHtmlispAttributes, renderHTMLisp } from "../htmlisp";
import { mergeClasses } from "./helpers";
import { BUTTON_CLASS_MAP } from "./styles";
import type { ButtonOptions } from "./types";

export function renderButton(options: ButtonOptions): string {
  const { label, href, type = "button", variant = "neutral", className, attributes } = options;

  const mergedClassName = mergeClasses(BUTTON_CLASS_MAP[variant], className);
  const extraAttributes = htmlispAttributesToMap(parseHtmlispAttributes(attributes));

  if (href) {
    return renderHTMLisp(
      `<a
        &href="href"
        &class="className"
        &attrs="extraAttributes"
        &children="label"
      ></a>`,
      { className: mergedClassName, extraAttributes, href, label },
      undefined,
      { escapeByDefault: true },
    );
  }

  return renderHTMLisp(
    `<button
      &type="type"
      &class="className"
      &attrs="extraAttributes"
      &children="label"
    ></button>`,
    {
      className: mergedClassName,
      extraAttributes,
      label,
      type,
    },
    undefined,
    { escapeByDefault: true },
  );
}
