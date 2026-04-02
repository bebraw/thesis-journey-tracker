import { raw, renderEscapedHTMLisp } from "../../htmlisp";
import { mergeClasses } from "../helpers";
import { SECTION_HEADER_ROW, SECTION_META_TEXT } from "../styles";
import type { SectionHeaderOptions } from "./section-header.types";

export function renderSectionHeader(options: SectionHeaderOptions): string {
  const {
    title,
    meta,
    headingLevel = 3,
    className,
    headingClassName,
    metaClassName,
  } = options;

  const titleTag = `h${headingLevel}`;
  const headingMarkup = renderEscapedHTMLisp(
    `<${titleTag} &class="headingClassName" &children="title"></${titleTag}>`,
    {
      headingClassName: mergeClasses("text-base font-semibold", headingClassName),
      title,
    },
  );
  const metaMarkup = meta
    ? renderEscapedHTMLisp(
        `<p &class="metaClassName" &children="meta"></p>`,
        {
          metaClassName: mergeClasses(SECTION_META_TEXT, metaClassName),
          meta,
        },
      )
    : "";

  return renderEscapedHTMLisp(
    `<div &class="className">
      <fragment &children="headingMarkup"></fragment>
      <fragment &children="metaMarkup"></fragment>
    </div>`,
    {
      className: mergeClasses(SECTION_HEADER_ROW, className),
      headingMarkup: raw(headingMarkup),
      metaMarkup: raw(metaMarkup),
    },
  );
}
