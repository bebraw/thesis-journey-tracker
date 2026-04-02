import { raw, renderEscapedHTMLisp } from "../htmlisp";
import { mergeClasses } from "./helpers";
import { SURFACE_CARD, SURFACE_CARD_SM } from "./styles";

export function renderCard(content: string, className?: string): string {
  return renderEscapedHTMLisp(
    `<article &class="className">
      <fragment &children="content"></fragment>
    </article>`,
    {
      className: mergeClasses(SURFACE_CARD, className),
      content: raw(content),
    },
  );
}

export function renderCompactCard(content: string, className?: string): string {
  return renderEscapedHTMLisp(
    `<article &class="className">
      <fragment &children="content"></fragment>
    </article>`,
    {
      className: mergeClasses(SURFACE_CARD_SM, className),
      content: raw(content),
    },
  );
}
