export type HtmlispProps = Record<string, unknown>;
export type AttributeValue = string | true;
export type HtmlispComponent = string | ((props: HtmlispProps) => string);
export type HtmlispComponents = Record<string, HtmlispComponent>;
export type HtmlispRenderOptions = {
  escapeByDefault?: boolean;
};
export type HtmlispAttributeMap = Record<string, string | boolean | null | undefined>;

export interface ParsedAttribute {
  name: string;
  value: AttributeValue;
}
