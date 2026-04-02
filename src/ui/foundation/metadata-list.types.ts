import type { HtmlispAttributeMap } from "../../htmlisp";

export interface MetadataItem {
  label: string;
  value: string;
}

export interface MetadataListOptions {
  items: MetadataItem[];
  className?: string;
  itemClassName?: string;
  termClassName?: string;
  valueClassName?: string;
  attrs?: HtmlispAttributeMap;
}
