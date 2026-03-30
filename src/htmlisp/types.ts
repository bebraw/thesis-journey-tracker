export type HtmlispProps = Record<string, unknown>;
export type AttributeValue = string | true;
export type HtmlispComponents = Record<string, string>;

export interface ParsedAttribute {
  name: string;
  value: AttributeValue;
}
