import { htmlispToHTMLSync } from "htmlisp";

import { escapeHtml } from "./formatting";

export type HtmlispProps = Record<string, unknown>;
export type AttributeValue = string | true;
export type HtmlispComponents = Record<string, string>;

export interface ParsedAttribute {
  name: string;
  value: AttributeValue;
}

const ATTRIBUTE_PATTERN = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const SAFE_ATTRIBUTE_NAME = /^[A-Za-z_:][-A-Za-z0-9_:.]*$/;

export function renderHTMLisp(htmlInput: string, props: HtmlispProps = {}, components?: HtmlispComponents): string {
  return htmlispToHTMLSync({ htmlInput, props, components });
}

export function parseHtmlispAttributes(attributes?: string): ParsedAttribute[] {
  if (!attributes) {
    return [];
  }

  const parsed: ParsedAttribute[] = [];
  const input = attributes.trim();

  for (const match of input.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1];
    if (!name || !SAFE_ATTRIBUTE_NAME.test(name)) {
      continue;
    }

    const value = match[2] ?? match[3] ?? match[4];
    parsed.push({ name, value: value === undefined ? true : value });
  }

  return parsed;
}

export function serializeHtmlispAttributes(attributes: ParsedAttribute[]): string {
  if (attributes.length === 0) {
    return "";
  }

  return attributes
    .map((attribute) => (attribute.value === true ? ` ${attribute.name}` : ` ${attribute.name}="${escapeHtml(attribute.value)}"`))
    .join("");
}

export function getHtmlispAttributeValue(attributes: ParsedAttribute[], name: string): string | undefined {
  const match = attributes.find((attribute) => attribute.name === name);
  return typeof match?.value === "string" ? match.value : undefined;
}

export function hasHtmlispBooleanAttribute(attributes: ParsedAttribute[], name: string): boolean {
  return attributes.some((attribute) => attribute.name === name && attribute.value === true);
}

export function omitHtmlispAttributes(attributes: ParsedAttribute[], names: string[]): ParsedAttribute[] {
  return attributes.filter((attribute) => !names.includes(attribute.name));
}

export function buildHtmlispAttributes(entries: Array<{ name: string; value: string | true | undefined }>): ParsedAttribute[] {
  return entries
    .filter((entry) => entry.value !== undefined && SAFE_ATTRIBUTE_NAME.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      value: entry.value as AttributeValue,
    }));
}
