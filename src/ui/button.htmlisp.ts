import { buildHtmlispAttributeMap, mergeHtmlispAttributeMaps, renderEscapedHTMLisp } from "../htmlisp";
import { mergeClasses } from "./helpers";
import { BUTTON_CLASS_MAP } from "./styles";
import type { ButtonOptions } from "./types";

export function renderButton(options: ButtonOptions): string {
  const { label, href, type = "button", variant = "neutral", className, attrs } = options;

  const mergedClassName = mergeClasses(BUTTON_CLASS_MAP[variant], className);

  if (href) {
    const attributesMap = mergeHtmlispAttributeMaps(
      attrs,
      buildHtmlispAttributeMap([
        { name: "href", value: href },
        { name: "class", value: mergedClassName },
      ]),
    );

    return renderEscapedHTMLisp(
      `<a
        &attrs="attributesMap"
        &children="label"
      ></a>`,
      { attributesMap, label },
    );
  }

  const attributesMap = mergeHtmlispAttributeMaps(
    attrs,
    buildHtmlispAttributeMap([
      { name: "type", value: type },
      { name: "class", value: mergedClassName },
    ]),
  );

  return renderEscapedHTMLisp(
    `<button
      &attrs="attributesMap"
      &children="label"
    ></button>`,
    { attributesMap, label },
  );
}
