import type { HtmlispAttributeMap } from "../../htmlisp";

export interface DangerPanelOptions {
  title: string;
  text: string;
  content?: string;
  className?: string;
  titleClassName?: string;
  textClassName?: string;
  attrs?: HtmlispAttributeMap;
}
