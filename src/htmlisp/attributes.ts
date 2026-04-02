import type { HtmlispAttributeMap } from "./types";

const SAFE_ATTRIBUTE_NAME = /^[A-Za-z_:][-A-Za-z0-9_:.]*$/;

export function buildHtmlispAttributeMap(entries: Array<{ name: string; value: string | boolean | null | undefined }>): HtmlispAttributeMap {
  return Object.fromEntries(
    entries
      .filter((entry) => entry.value !== undefined && entry.value !== null && entry.value !== false && SAFE_ATTRIBUTE_NAME.test(entry.name))
      .map((entry) => [entry.name, entry.value]),
  );
}
