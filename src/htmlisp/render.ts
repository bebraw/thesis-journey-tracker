import { htmlispToHTMLSync } from "htmlisp";

import type { HtmlispComponents, HtmlispProps } from "./types";

export function renderHTMLisp(htmlInput: string, props: HtmlispProps = {}, components?: HtmlispComponents): string {
  return htmlispToHTMLSync({ htmlInput, props, components });
}
