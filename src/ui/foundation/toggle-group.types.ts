import type { HtmlispAttributeMap } from "../../htmlisp";

export interface ToggleItem {
  label: string;
  pressed?: boolean;
  meta?: string;
  attrs?: HtmlispAttributeMap;
}

export interface ToggleGroupOptions {
  items: ToggleItem[];
  className?: string;
  buttonClassName?: string;
  metaClassName?: string;
}
