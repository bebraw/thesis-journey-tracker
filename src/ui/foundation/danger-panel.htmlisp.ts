import { mergeHtmlispAttributeMaps, raw, renderEscapedHTMLisp } from "../../htmlisp";
import { mergeClasses } from "../helpers";
import { DANGER_PANEL, DANGER_TEXT, DANGER_TITLE } from "../styles";
import type { DangerPanelOptions } from "../types";

export function renderDangerPanel(options: DangerPanelOptions): string {
  const {
    title,
    text,
    content,
    className,
    titleClassName = DANGER_TITLE,
    textClassName = DANGER_TEXT,
    attrs,
  } = options;

  const attributesMap = mergeHtmlispAttributeMaps(
    attrs,
    { class: mergeClasses(DANGER_PANEL, className) },
  );

  return renderEscapedHTMLisp(
    `<section &attrs="attributesMap">
      <h3 &class="titleClassName" &children="title"></h3>
      <p &class="textClassName" &children="text"></p>
      <fragment &visibleIf="contentVisible" &children="content"></fragment>
    </section>`,
    {
      attributesMap,
      titleClassName,
      title,
      textClassName,
      text,
      contentVisible: Boolean(content),
      content: raw(content || ""),
    },
  );
}
