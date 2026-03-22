import { escapeHtml } from "../utils";
import { renderHTMLisp } from "../htmlisp";
import { mergeClasses } from "./helpers";
import { BADGE_CLASS_MAP } from "./styles";
import type { BadgeOptions } from "./types";

export function renderBadge(options: BadgeOptions): string {
  const { label, variant = "neutral", className } = options;

  return renderHTMLisp(
    `<span
      &class="(get props className)"
      &children="(get props label)"
    ></span>`,
    {
      className: escapeHtml(mergeClasses(BADGE_CLASS_MAP[variant], className)),
      label: escapeHtml(label),
    },
  );
}
