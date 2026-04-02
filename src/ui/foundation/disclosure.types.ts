import type { HtmlispAttributeMap } from "../../htmlisp";

export interface DisclosureOptions {
  summary: string;
  content: string;
  className?: string;
  summaryClassName?: string;
  contentClassName?: string;
  attrs?: HtmlispAttributeMap;
}
