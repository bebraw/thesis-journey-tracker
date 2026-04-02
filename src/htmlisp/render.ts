import { htmlispToHTMLSync, raw } from "htmlisp";

import type { HtmlispComponents, HtmlispProps, HtmlispRenderOptions } from "./types";

export function renderHTMLisp(
  htmlInput: string,
  props: HtmlispProps = {},
  components?: HtmlispComponents,
  renderOptions?: HtmlispRenderOptions,
): string {
  return htmlispToHTMLSync({ htmlInput, props, components, renderOptions });
}

export { raw };
