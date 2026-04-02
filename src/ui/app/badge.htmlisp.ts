import { renderEscapedHTMLisp } from "../../htmlisp";
import { mergeClasses } from "../helpers";
import { BADGE_CLASS_MAP } from "../styles";
import type { BadgeOptions } from "./badge.types";

export function renderBadge(options: BadgeOptions): string {
  const { label, variant = "neutral", className } = options;

  return renderEscapedHTMLisp(
    `<span
      &class="className"
      &children="label"
    ></span>`,
    {
      className: mergeClasses(BADGE_CLASS_MAP[variant], className),
      label,
    },
  );
}
