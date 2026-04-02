import type { HtmlispAttributeMap, ParsedAttribute } from "./types";

const ATTRIBUTE_PATTERN = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const SAFE_ATTRIBUTE_NAME = /^[A-Za-z_:][-A-Za-z0-9_:.]*$/;

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

export function htmlispAttributesToMap(attributes: ParsedAttribute[]): HtmlispAttributeMap {
  return Object.fromEntries(attributes.map((attribute) => [attribute.name, attribute.value]));
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

export function buildHtmlispAttributeMap(entries: Array<{ name: string; value: string | boolean | null | undefined }>): HtmlispAttributeMap {
  return Object.fromEntries(
    entries
      .filter((entry) => entry.value !== undefined && entry.value !== null && entry.value !== false && SAFE_ATTRIBUTE_NAME.test(entry.name))
      .map((entry) => [entry.name, entry.value]),
  );
}
