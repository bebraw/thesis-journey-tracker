import type { HtmlispAttributeMap } from "../../htmlisp";

export type ButtonVariant = "neutral" | "primary" | "primaryBlock" | "successBlock" | "dangerBlock" | "inline";

export interface ButtonOptions {
  label: string;
  href?: string;
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
  className?: string;
  attrs?: HtmlispAttributeMap;
}
