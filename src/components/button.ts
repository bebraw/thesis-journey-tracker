import { escapeHtml } from "../utils";
import {
  parseHtmlispAttributes,
  renderHTMLisp,
  serializeHtmlispAttributes,
} from "../htmlisp";
import { fillTemplate, mergeClasses } from "./helpers";
import { BUTTON_CLASS_MAP } from "./styles";
import type { ButtonOptions } from "./types";

export function renderButton(options: ButtonOptions): string {
  const {
    label,
    href,
    type = "button",
    variant = "neutral",
    className,
    attributes,
  } = options;

  const mergedClassName = escapeHtml(
    mergeClasses(BUTTON_CLASS_MAP[variant], className),
  );
  const extraAttributes = serializeHtmlispAttributes(
    parseHtmlispAttributes(attributes),
  );
  const safeLabel = escapeHtml(label);

  if (href) {
    return renderHTMLisp(
      fillTemplate(
        '<a &href="(get props href)" &class="(get props className)"__EXTRA_ATTRIBUTES__ &children="(get props label)"></a>',
        {
          __EXTRA_ATTRIBUTES__: extraAttributes,
        },
      ),
      { className: mergedClassName, href: escapeHtml(href), label: safeLabel },
    );
  }

  return renderHTMLisp(
    fillTemplate(
      '<button &type="(get props type)" &class="(get props className)"__EXTRA_ATTRIBUTES__ &children="(get props label)"></button>',
      {
        __EXTRA_ATTRIBUTES__: extraAttributes,
      },
    ),
    {
      className: mergedClassName,
      label: safeLabel,
      type: escapeHtml(type),
    },
  );
}
