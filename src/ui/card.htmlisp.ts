import { escapeHtml } from "../formatting";
import { renderHTMLisp } from "../htmlisp";
import { mergeClasses } from "./helpers";
import { SURFACE_CARD, SURFACE_CARD_SM } from "./styles";

export function renderCard(content: string, className?: string): string {
  return renderHTMLisp(
    `<article &class="(get props className)">
      <noop &children="(get props content)"></noop>
    </article>`,
    {
      className: escapeHtml(mergeClasses(SURFACE_CARD, className)),
      content,
    },
  );
}

export function renderCompactCard(content: string, className?: string): string {
  return renderHTMLisp(
    `<article &class="(get props className)">
      <noop &children="(get props content)"></noop>
    </article>`,
    {
      className: escapeHtml(mergeClasses(SURFACE_CARD_SM, className)),
      content,
    },
  );
}
