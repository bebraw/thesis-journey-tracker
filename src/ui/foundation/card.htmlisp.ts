import type { HtmlispAttributeMap } from "../../htmlisp";
import { mergeHtmlispAttributeMaps, raw, renderEscapedHTMLisp } from "../../htmlisp";
import { mergeClasses } from "../helpers";
import { INSET_SURFACE_CARD, SURFACE_CARD, SURFACE_CARD_SM } from "../styles";

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

export function renderInsetCard(content: string, className?: string, attrs?: HtmlispAttributeMap): string {
  const attributesMap = mergeHtmlispAttributeMaps(
    attrs,
    { class: mergeClasses(INSET_SURFACE_CARD, className) },
  );

  return renderEscapedHTMLisp(
    `<section &attrs="attributesMap">
      <fragment &children="content"></fragment>
    </section>`,
    {
      attributesMap,
      content: raw(content),
    },
  );
}
