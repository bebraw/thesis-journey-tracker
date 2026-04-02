import type { HtmlispAttributeMap } from "../htmlisp";

export type ButtonVariant = "neutral" | "primary" | "primaryBlock" | "successBlock" | "dangerBlock" | "inline";

export type BadgeVariant = "neutral" | "mock" | "count";

export interface ButtonOptions {
  label: string;
  href?: string;
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
  className?: string;
  attrs?: HtmlispAttributeMap;
}

export interface BadgeOptions {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export interface SectionHeaderOptions {
  title: string;
  meta?: string;
  headingLevel?: 2 | 3 | 4;
  className?: string;
  headingClassName?: string;
  metaClassName?: string;
}

export interface DisclosureOptions {
  summary: string;
  content: string;
  className?: string;
  summaryClassName?: string;
  contentClassName?: string;
  attrs?: HtmlispAttributeMap;
}

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

export interface SelectOption {
  label: string;
  value: string;
}

export interface FieldOptions {
  label: string;
  name?: string;
  id?: string;
  type?: string;
  value?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
  attrs?: HtmlispAttributeMap;
}

export interface SelectFieldOptions {
  label: string;
  name?: string;
  id?: string;
  options: SelectOption[];
  value?: string;
  className?: string;
  wrapperClassName?: string;
  attrs?: HtmlispAttributeMap;
}

export interface TextareaFieldOptions {
  label: string;
  name?: string;
  id?: string;
  value?: string;
  rows?: number;
  className?: string;
  wrapperClassName?: string;
  required?: boolean;
  attrs?: HtmlispAttributeMap;
}
